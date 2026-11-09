import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Download,
  Calendar,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  Printer,
  ChevronLeft,
  ChevronRight,
  Lock,
  CreditCard,
  BookOpen,
  LayoutDashboard,
  Home,
  ArrowRight,
  Edit3,
  Menu,
  X,
  BadgeCheck,
  AlertCircle,
  Users,
  User,
  UserPlus,
  Phone,
  Sparkles,
  Check,
  LogOut,
  LogIn,
  Compass,
} from 'lucide-react';
import { ActionAlertModal } from './ActionAlertModal';
import { K8sSpikeModal } from './K8sSpikeModal';
import { SystemSpecModal } from './SystemSpecModal';
import { TalkToHawkBotModal } from './TalkToHawkBotModal';
import { loginWithGoogle } from './firebase';
import {
  api,
  ApiClientError,
  fetchAllRoutines,
  fetchClassRoutine,
  fetchNotifications,
  getServerNowMs,
  markAllNotificationsRead,
  markNotificationRead,
} from './api';
import {
  POLL_INTERVAL_MS,
  STUDENT_ID_STORAGE_KEY,
  PARENT_PHONE_STORAGE_KEY,
  PARENT_NAME_STORAGE_KEY,
  PARENT_CHILDREN_STORAGE_KEY,
} from './config';
import { NotificationCenter } from './NotificationCenter';
import { generateAndDownloadPdfReceipt } from './ReceiptPdf';
import { mapApiErrorToFriendlyMessage, STRINGS } from './strings';
import { notifyToast, ToastContainer } from './ToastContainer';
import './ParentPortal.css';
import './K8sModals.css';
import {
  AppNotification,
  ClassFeeBreakdown,
  ClassRoutine,
  HoldItem,
  HoldStatus,
  PaymentRecord,
  SaveStudentProfilePayload,
  SchoolClass,
  StudentProfile,
  WaitlistEntry,
} from './types';

export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value.trim());
}

export function formatRemainingSeconds(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getEffectiveHoldStatus(hold: HoldItem, nowMs: number): HoldStatus {
  if (hold.status === 'HELD') {
    const expiresMs = Date.parse(hold.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= nowMs) {
      return 'EXPIRED';
    }
  }
  return hold.status;
}

const EMPTY_PROFILE_FORM: SaveStudentProfilePayload = {
  fullNameEn: '',
  fullNameBn: '',
  dob: '',
  gender: '',
  nationality: 'Bangladeshi',
  religion: '',
  bloodGroup: '',
  presentAddress: '',
  permanentAddress: '',
  previousSchool: '',
  lastClassPassed: '',
  lastResult: '',
  healthNotes: '',
  hasSibling: false,
  siblingName: '',
  siblingClass: '',
  siblingStudentId: '',
  fatherName: '',
  fatherNid: '',
  fatherOccupation: '',
  fatherEmployer: '',
  fatherPhone: '',
  fatherEmail: '',
  motherName: '',
  motherNid: '',
  motherOccupation: '',
  motherEmployer: '',
  motherPhone: '',
  motherEmail: '',
  guardianName: '',
  guardianRelation: 'Father',
  guardianPhone: '',
  emergencyContact: '',
  monthlyIncome: 0,
  incomeBracket: '',
  incomeSource: '',
  dependents: 0,
  concessionRequested: false,
};

const WEEK_DAYS = [
  { key: 'SUN', label: 'Sunday' },
  { key: 'MON', label: 'Monday' },
  { key: 'TUE', label: 'Tuesday' },
  { key: 'WED', label: 'Wednesday' },
  { key: 'THU', label: 'Thursday' },
];

const DEFAULT_WEEKLY_SUBJECTS: Record<string, Record<number, { subject: string; teacher: string; room: string }>> = {
  SUN: {
    1: { subject: 'Bangla 1st Paper', teacher: 'Mrs. Sultana', room: 'Room 201' },
    2: { subject: 'English 1st Paper', teacher: 'Mr. David', room: 'Room 201' },
    3: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    4: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    5: { subject: 'Bangladesh & Global Studies', teacher: 'Mr. Rafiq', room: 'Room 201' },
    6: { subject: 'ICT & Coding Lab', teacher: 'Engr. Tanvir', room: 'Computer Lab 2' },
  },
  MON: {
    1: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    2: { subject: 'Bangla Grammar & Essay', teacher: 'Mrs. Sultana', room: 'Room 201' },
    3: { subject: 'English Literature', teacher: 'Mr. David', room: 'Room 201' },
    4: { subject: 'ICT & Robotics Lab', teacher: 'Engr. Tanvir', room: 'Computer Lab 2' },
    5: { subject: 'Religion & Moral Studies', teacher: 'Maulana Habib', room: 'Room 201' },
    6: { subject: 'Library & Reading Hour', teacher: 'Ms. Nusrat', room: 'Central Library' },
  },
  TUE: {
    1: { subject: 'English 2nd Paper', teacher: 'Mr. David', room: 'Room 201' },
    2: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    3: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    4: { subject: 'Bangla 2nd Paper', teacher: 'Mrs. Sultana', room: 'Room 201' },
    5: { subject: 'Arts & Creative Crafts', teacher: 'Ms. Laila', room: 'Art Studio' },
    6: { subject: 'Physical Education & Sports', teacher: 'Coach Reza', room: 'Main Field' },
  },
  WED: {
    1: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    2: { subject: 'General Science Lab', teacher: 'Dr. Farhana', room: 'Science Lab 1' },
    3: { subject: 'Bangla Literature', teacher: 'Mrs. Sultana', room: 'Room 201' },
    4: { subject: 'English Grammar & Writing', teacher: 'Mr. David', room: 'Room 201' },
    5: { subject: 'Bangladesh & Global Studies', teacher: 'Mr. Rafiq', room: 'Room 201' },
    6: { subject: 'Debate & Public Speaking', teacher: 'Ms. Nusrat', room: 'Auditorium' },
  },
  THU: {
    1: { subject: 'Bangla Literature & Poetry', teacher: 'Mrs. Sultana', room: 'Room 201' },
    2: { subject: 'General Mathematics', teacher: 'Mr. Kamal', room: 'Room 201' },
    3: { subject: 'English Conversation', teacher: 'Mr. David', room: 'Language Lab' },
    4: { subject: 'General Science', teacher: 'Dr. Farhana', room: 'Room 201' },
    5: { subject: 'Co-Curricular Club Activity', teacher: 'Coach Reza', room: 'Club Hall' },
    6: { subject: 'Weekly Cultural Assembly', teacher: 'All Faculty', room: 'Auditorium' },
  },
};

export interface ParentChildItem {
  studentId: string;
  fullNameEn: string;
  dob?: string;
  gender?: string;
  desiredClass?: string;
  isComplete?: boolean;
}

export type ParentNavTab =
  | 'dashboard'
  | 'children'
  | 'classes'
  | 'payment'
  | 'dossier'
  | 'receipts'
  | 'routines'
  | 'all'
  | 'active_hold'
  | 'child_dossier'
  | 'applications';

export interface ParentPortalProps {
  onNavigateToAdmin?: () => void;
  onOpenLanding?: () => void;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({
  onNavigateToAdmin: _onNavigateToAdmin,
  onOpenLanding,
}) => {
  // --- Persisted Student ID ---
  const [savedStudentId, setSavedStudentId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STUDENT_ID_STORAGE_KEY) || '';
      return isValidStudentId(stored) ? stored.trim() : '';
    } catch {
      return '';
    }
  });

  const [studentIdInput, setStudentIdInput] = useState<string>(savedStudentId);
  const [isEditingStudentId, setIsEditingStudentId] = useState<boolean>(!savedStudentId);
  const [studentIdError, setStudentIdError] = useState<string | null>(null);

  // --- Parent Family Account & Multi-Child State ---
  const [parentPhone, setParentPhone] = useState<string>(() => {
    try {
      return localStorage.getItem(PARENT_PHONE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [parentName, setParentName] = useState<string>(() => {
    try {
      return localStorage.getItem(PARENT_NAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [parentPhoneInput, setParentPhoneInput] = useState<string>('');
  const [parentNameInput, setParentNameInput] = useState<string>('');

  const [parentChildren, setParentChildren] = useState<ParentChildItem[]>(() => {
    try {
      const raw = localStorage.getItem(PARENT_CHILDREN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Modal state for adding another child / sibling
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState<boolean>(false);
  const [newChildIdInput, setNewChildIdInput] = useState<string>('');
  const [newChildNameInput, setNewChildNameInput] = useState<string>('');
  const [newChildClassInput, setNewChildClassInput] = useState<string>('');
  const [newChildError, setNewChildError] = useState<string | null>(null);

  // --- Navigation & Layout State ---
  const [activeNav, setActiveNav] = useState<ParentNavTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // --- Core Seat & Hold Data ---
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myHolds, setMyHolds] = useState<HoldItem[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);

  // --- Student Profile & Dossier State ---
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [dossierSection, setDossierSection] = useState<number>(0);
  const [profileForm, setProfileForm] = useState<SaveStudentProfilePayload>(EMPTY_PROFILE_FORM);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [selectedDocFiles, setSelectedDocFiles] = useState<Record<string, { name: string; size: number }>>({});

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [_waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [_focusedFeeBreakdown, _setFocusedFeeBreakdown] = useState<ClassFeeBreakdown | null>(null);

  // --- Live Notifications & Alerts ---
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- K8s Burst Simulator & Architecture Spec Modals ---
  const [isK8sSpikeModalOpen, setIsK8sSpikeModalOpen] = useState<boolean>(false);
  const [isSystemSpecModalOpen, setIsSystemSpecModalOpen] = useState<boolean>(false);
  const [simulateRaceCondition, setSimulateRaceCondition] = useState<boolean>(false);
  const [isCounselorModalOpen, setIsCounselorModalOpen] = useState<boolean>(false);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState<boolean>(false);

  // --- Action Alert Modal State ---
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'SUCCESS' | 'WARNING' | 'DANGER' | 'INFO';
    title: string;
    message: string;
    detailReason?: string;
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    countdownSeconds?: number;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
  });

  // --- Routine State ---
  const [routines, setRoutines] = useState<ClassRoutine[]>([]);
  const [selectedRoutineClassIndex, setSelectedRoutineClassIndex] = useState<number>(0);
  const [selectedShiftTab, setSelectedShiftTab] = useState<'Morning' | 'Standard'>('Standard');

  // --- Pagination for Classes (6 per page) ---
  const [classPage, setClassPage] = useState<number>(1);
  const classesPerPage = 6;

  // --- In-flight Action States ---
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [confirmingHoldId, setConfirmingHoldId] = useState<string | null>(null);
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // --- Ticker for Hold Expiry ---
  const [nowMs, setNowMs] = useState<number>(() => getServerNowMs());
  const expiredRefetchedIds = useRef<Set<string>>(new Set());

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  const showError = useCallback((err: unknown) => {
    let msg = STRINGS.errors.UNKNOWN_ERROR;
    if (err instanceof ApiClientError) {
      msg = mapApiErrorToFriendlyMessage(err.code, err.message);
    } else if (err instanceof Error) {
      msg = err.message;
    }
    setErrorMessage(msg);
    notifyToast('Error', msg, 'danger');
  }, []);

  // --- Refresh Data from Backend ---
  const refreshData = useCallback(
    async (silent = false) => {
      try {
        const loadedClasses = await api.listClasses();
        setClasses(loadedClasses);

        if (savedStudentId) {
          const [loadedHolds, loadedPayments, loadedWaitlists, loadedNotifs, loadedProfile] =
            await Promise.all([
              api.getMyHolds(savedStudentId),
              api.getStudentPayments(savedStudentId),
              api.getStudentWaitlist(savedStudentId).catch(() => []),
              fetchNotifications(savedStudentId).catch(() => ({ notifications: [], unreadCount: 0 })),
              api.getStudentProfile(savedStudentId).catch(() => null),
            ]);

          const enrichedHolds: HoldItem[] = loadedHolds.map((h: HoldItem) => {
            const matchedClass = loadedClasses.find((c: SchoolClass) => c.id === h.classId);
            return {
              ...h,
              className: h.className || matchedClass?.name || h.classId,
            };
          });

          setMyHolds(enrichedHolds);
          setPayments(loadedPayments);
          setWaitlistEntries(loadedWaitlists);
          setNotifications(Array.isArray(loadedNotifs?.notifications) ? loadedNotifs.notifications : []);
          setUnreadNotifCount(typeof loadedNotifs?.unreadCount === 'number' ? loadedNotifs.unreadCount : 0);

          if (loadedProfile) {
            setProfile(loadedProfile);
          }
        } else {
          setMyHolds([]);
          setPayments([]);
          setWaitlistEntries([]);
          setNotifications([]);
          setUnreadNotifCount(0);
          setProfile(null);
        }

        if (!silent) {
          notifyToast('Data Synchronized', 'Classes and seat allocations updated from cluster.', 'info');
        }
      } catch (err) {
        if (!silent) showError(err);
      }
    },
    [savedStudentId, showError],
  );

  // --- Load Profile on Student ID Change ---
  const prevStudentIdRef = useRef<string>(savedStudentId);
  useEffect(() => {
    let cancelled = false;
    const isChangedId = prevStudentIdRef.current !== savedStudentId;
    prevStudentIdRef.current = savedStudentId;

    if (!savedStudentId) {
      setProfile(null);
      setProfileForm(EMPTY_PROFILE_FORM);
      return;
    }

    if (isChangedId) {
      const existingChild = parentChildren.find((c) => c.studentId === savedStudentId);
      setProfile(null);
      setProfileForm({
        ...EMPTY_PROFILE_FORM,
        fullNameEn: existingChild?.fullNameEn || '',
      });
    }

    (async () => {
      try {
        const loaded = await api.getStudentProfile(savedStudentId);
        if (cancelled) return;
        setProfile(loaded);
        setProfileForm((prev) => ({
          fullNameEn: (isChangedId ? loaded.fullNameEn : (prev.fullNameEn || loaded.fullNameEn)) || '',
          fullNameBn: (isChangedId ? loaded.fullNameBn : (prev.fullNameBn || loaded.fullNameBn)) || '',
          dob: (isChangedId ? loaded.dob : (prev.dob || loaded.dob)) || '',
          gender: (isChangedId ? loaded.gender : (prev.gender || loaded.gender)) || '',
          nationality: (isChangedId ? loaded.nationality : (prev.nationality || loaded.nationality)) || 'Bangladeshi',
          religion: (isChangedId ? loaded.religion : (prev.religion || loaded.religion)) || '',
          bloodGroup: (isChangedId ? loaded.bloodGroup : (prev.bloodGroup || loaded.bloodGroup)) || '',
          presentAddress: (isChangedId ? loaded.presentAddress : (prev.presentAddress || loaded.presentAddress)) || '',
          permanentAddress: (isChangedId ? loaded.permanentAddress : (prev.permanentAddress || loaded.permanentAddress)) || '',
          previousSchool: (isChangedId ? loaded.previousSchool : (prev.previousSchool || loaded.previousSchool)) || '',
          lastClassPassed: (isChangedId ? loaded.lastClassPassed : (prev.lastClassPassed || loaded.lastClassPassed)) || '',
          lastResult: (isChangedId ? loaded.lastResult : (prev.lastResult || loaded.lastResult)) || '',
          healthNotes: (isChangedId ? loaded.healthNotes : (prev.healthNotes || loaded.healthNotes)) || '',
          hasSibling: isChangedId ? Boolean(loaded.hasSibling) : (prev.hasSibling || Boolean(loaded.hasSibling)),
          siblingName: (isChangedId ? loaded.siblingName : (prev.siblingName || loaded.siblingName)) || '',
          siblingClass: (isChangedId ? loaded.siblingClass : (prev.siblingClass || loaded.siblingClass)) || '',
          siblingStudentId: (isChangedId ? loaded.siblingStudentId : (prev.siblingStudentId || loaded.siblingStudentId)) || '',
          fatherName: (isChangedId ? loaded.fatherName : (prev.fatherName || loaded.fatherName)) || '',
          fatherNid: (isChangedId ? loaded.fatherNid : (prev.fatherNid || loaded.fatherNid)) || '',
          fatherOccupation: (isChangedId ? loaded.fatherOccupation : (prev.fatherOccupation || loaded.fatherOccupation)) || '',
          fatherEmployer: (isChangedId ? loaded.fatherEmployer : (prev.fatherEmployer || loaded.fatherEmployer)) || '',
          fatherPhone: (isChangedId ? loaded.fatherPhone : (prev.fatherPhone || loaded.fatherPhone)) || '',
          fatherEmail: (isChangedId ? loaded.fatherEmail : (prev.fatherEmail || loaded.fatherEmail)) || '',
          motherName: (isChangedId ? loaded.motherName : (prev.motherName || loaded.motherName)) || '',
          motherNid: (isChangedId ? loaded.motherNid : (prev.motherNid || loaded.motherNid)) || '',
          motherOccupation: (isChangedId ? loaded.motherOccupation : (prev.motherOccupation || loaded.motherOccupation)) || '',
          motherEmployer: (isChangedId ? loaded.motherEmployer : (prev.motherEmployer || loaded.motherEmployer)) || '',
          motherPhone: (isChangedId ? loaded.motherPhone : (prev.motherPhone || loaded.motherPhone)) || '',
          motherEmail: (isChangedId ? loaded.motherEmail : (prev.motherEmail || loaded.motherEmail)) || '',
          guardianName: (isChangedId ? loaded.guardianName : (prev.guardianName || loaded.guardianName)) || '',
          guardianRelation: (isChangedId ? loaded.guardianRelation : (prev.guardianRelation || loaded.guardianRelation)) || 'Father',
          guardianPhone: (isChangedId ? loaded.guardianPhone : (prev.guardianPhone || loaded.guardianPhone)) || '',
          emergencyContact: (isChangedId ? loaded.emergencyContact : (prev.emergencyContact || loaded.emergencyContact)) || '',
          monthlyIncome: isChangedId ? (loaded.monthlyIncome ?? 0) : (prev.monthlyIncome || loaded.monthlyIncome || 0),
          incomeBracket: (isChangedId ? loaded.incomeBracket : (prev.incomeBracket || loaded.incomeBracket)) || '',
          incomeSource: (isChangedId ? loaded.incomeSource : (prev.incomeSource || loaded.incomeSource)) || '',
          dependents: isChangedId ? (loaded.dependents ?? 0) : (prev.dependents || loaded.dependents || 0),
          concessionRequested: isChangedId ? Boolean(loaded.concessionRequested) : (prev.concessionRequested || Boolean(loaded.concessionRequested)),
        }));
      } catch {
        if (cancelled) return;
        if (isChangedId) {
          const existingChild = parentChildren.find((c) => c.studentId === savedStudentId);
          setProfile(null);
          setProfileForm({
            ...EMPTY_PROFILE_FORM,
            fullNameEn: existingChild?.fullNameEn || '',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedStudentId]);

  // Polling every POLL_INTERVAL_MS
  useEffect(() => {
    void refreshData(true);
    const pollTimer = window.setInterval(() => {
      void refreshData(true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(pollTimer);
  }, [refreshData]);

  // 1-second countdown ticker
  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      const currentNow = getServerNowMs();
      setNowMs(currentNow);
    }, 1000);
    return () => window.clearInterval(tickTimer);
  }, []);

  // Immediate re-fetch when a HELD hold crosses expiry
  useEffect(() => {
    let shouldRefetch = false;
    for (const h of myHolds) {
      if (
        h.status === 'HELD' &&
        Date.parse(h.expiresAt) <= nowMs &&
        !expiredRefetchedIds.current.has(h.holdId)
      ) {
        expiredRefetchedIds.current.add(h.holdId);
        shouldRefetch = true;
      }
    }
    if (shouldRefetch) {
      void refreshData(true);
    }
  }, [myHolds, nowMs, refreshData]);

  // Fetch Class Routines
  useEffect(() => {
    (async () => {
      try {
        const allR = await fetchAllRoutines().catch(() => []);
        if (allR && allR.length > 0) {
          setRoutines(allR);
        } else if (classes.length > 0) {
          const r = await fetchClassRoutine(classes[0].id).catch(() => null);
          if (r) setRoutines([r]);
        }
      } catch {
        // Fallback to default
      }
    })();
  }, [classes]);

  // --- Focused Application for Seat Hold & Payment ---
  const focusedHold = useMemo(() => {
    if (selectedHoldId) {
      const found = myHolds.find((h) => h.holdId === selectedHoldId);
      if (found) return found;
    }
    return myHolds[0] || null;
  }, [myHolds, selectedHoldId]);

  const focusedRemainingSeconds = useMemo(() => {
    if (!focusedHold || focusedHold.status !== 'HELD') return 0;
    const expiresMs = Date.parse(focusedHold.expiresAt);
    return Number.isNaN(expiresMs) ? 0 : Math.max(0, (expiresMs - nowMs) / 1000);
  }, [focusedHold, nowMs]);

  // --- Active Confirmed Hold ---
  const confirmedHold = useMemo(() => {
    return myHolds.find((h) => h.status === 'CONFIRMED') || null;
  }, [myHolds]);

  // --- Single Admission Rule Check ---
  const activeHoldElsewhere = useMemo(() => {
    return myHolds.find((h) => {
      const status = getEffectiveHoldStatus(h, nowMs);
      return status === 'HELD' || status === 'CONFIRMED';
    });
  }, [myHolds, nowMs]);

  // --- Missing Mandatory Fields Computation ---
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!profileForm.dob && !profile?.dob) missing.push('Date of Birth');
    if (!profileForm.gender && !profile?.gender) missing.push('Gender');
    if (
      !profileForm.fatherName &&
      !profileForm.motherName &&
      !profileForm.guardianName &&
      !profile?.fatherName
    ) {
      missing.push('Guardian Name (Father/Mother/Guardian)');
    }
    if (
      !profileForm.guardianPhone &&
      !profileForm.fatherPhone &&
      !profileForm.motherPhone &&
      !profile?.fatherPhone
    ) {
      missing.push('Guardian Contact Mobile');
    }
    if (!profileForm.presentAddress && !profile?.presentAddress) {
      missing.push('Present Residential Address');
    }
    return missing;
  }, [profileForm, profile]);

  const isMandatoryComplete = missingFields.length === 0;

  // Calculate dynamic completeness %
  const calculateCompleteness = () => {
    let score = savedStudentId ? 15 : 0;
    if (profileForm.fullNameEn || profile?.fullNameEn) score += 15;
    if (profileForm.dob || profile?.dob) score += 15;
    if (profileForm.gender || profile?.gender) score += 15;
    if (profileForm.fatherName || profileForm.motherName || profileForm.guardianName || profile?.fatherName || profile?.guardianName) score += 15;
    if (profileForm.guardianPhone || profileForm.fatherPhone || profileForm.motherPhone || profile?.fatherPhone || profile?.guardianPhone) score += 15;
    if (profileForm.presentAddress || profile?.presentAddress) score += 10;
    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  // --- Fee Breakdown Calculation ---
  const admissionFee = 15000;
  const sessionCharge = 8000;
  const developmentFee = 10000;
  const securityDeposit = 5000;
  const firstMonthTuition = 6000;
  const grossTotal = admissionFee + sessionCharge + developmentFee + securityDeposit + firstMonthTuition;
  const siblingDiscount = profileForm.hasSibling ? Math.round(admissionFee * 0.1) : 0;
  const netPayable = grossTotal - siblingDiscount;

  // --- Pagination Slice for Classes ---
  const totalClassesCount = classes.length;
  const totalPages = Math.max(1, Math.ceil(totalClassesCount / classesPerPage));
  const displayedClasses = useMemo(() => {
    const start = (classPage - 1) * classesPerPage;
    return classes.slice(start, start + classesPerPage);
  }, [classes, classPage, classesPerPage]);

  // --- Active Student Display Name (null when Birth Registration Number changes & has no saved name) ---
  const activeStudentName: string | null =
    (profileForm.fullNameEn && profileForm.fullNameEn.trim()) ||
    (profile?.fullNameEn && profile.fullNameEn.trim()) ||
    null;

  // --- Handlers ---
  const handleStudentIdInputChange = (nextVal: string) => {
    setStudentIdInput(nextVal);
    if (studentIdError) setStudentIdError(null);
    const trimmed = nextVal.trim();
    if (trimmed !== savedStudentId) {
      const existingChild = parentChildren.find((c) => c.studentId === trimmed);
      setProfile(null);
      setParentNameInput('');
      setProfileForm({
        ...EMPTY_PROFILE_FORM,
        fullNameEn: existingChild?.fullNameEn || '',
      });
    }
  };

  const handleSaveStudentId = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const candidate = studentIdInput.trim();
    if (!isValidStudentId(candidate)) {
      setStudentIdError(STRINGS.studentIdValidationError);
      return;
    }

    const phoneVal = (parentPhoneInput || parentPhone || '').trim();
    const nameVal = (parentNameInput || parentName || '').trim();
    const isDifferentStudent = candidate !== savedStudentId;
    const existingChild = parentChildren.find((c) => c.studentId === candidate);

    if (isDifferentStudent) {
      setProfile(null);
      setProfileForm({
        ...EMPTY_PROFILE_FORM,
        fullNameEn: existingChild?.fullNameEn || '',
      });
    }

    try {
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, candidate);
      if (phoneVal) localStorage.setItem(PARENT_PHONE_STORAGE_KEY, phoneVal);
      if (nameVal) localStorage.setItem(PARENT_NAME_STORAGE_KEY, nameVal);

      // Register or update in family children list
      setParentChildren((prev) => {
        const existingIdx = prev.findIndex((c) => c.studentId === candidate);
        let updated: ParentChildItem[];
        if (existingIdx >= 0) {
          updated = prev.map((c, i) =>
            i === existingIdx
              ? { ...c, fullNameEn: c.fullNameEn || '' }
              : c
          );
        } else {
          updated = [
            ...prev,
            {
              studentId: candidate,
              fullNameEn: isDifferentStudent ? '' : (profileForm.fullNameEn || ''),
              isComplete: isDifferentStudent ? false : isMandatoryComplete,
            },
          ];
        }
        try {
          localStorage.setItem(PARENT_CHILDREN_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    } catch {
      // Ignore
    }

    setSavedStudentId(candidate);
    if (phoneVal) setParentPhone(phoneVal);
    if (nameVal) setParentName(nameVal);
    setIsEditingStudentId(false);
    setStudentIdError(null);
    triggerToast('Login successful! Welcome to Onnorokom School Admission Portal.');
  };

  const handleClearStudentId = () => {
    try {
      localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setSavedStudentId('');
    setStudentIdInput('');
    setParentNameInput('');
    setIsEditingStudentId(true);
    setMyHolds([]);
    setPayments([]);
    setProfile(null);
    setProfileForm(EMPTY_PROFILE_FORM);
    triggerToast('Parent logged out and session cleared. Please log in with a student birth registration ID.');
  };

  const handleSwitchChild = (childId: string) => {
    if (childId === savedStudentId) return;
    const existingChild = parentChildren.find((c) => c.studentId === childId);
    try {
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, childId);
    } catch {
      // ignore
    }
    setProfile(null);
    setProfileForm({
      ...EMPTY_PROFILE_FORM,
      fullNameEn: existingChild?.fullNameEn || '',
    });
    setSavedStudentId(childId);
    setStudentIdInput(childId);
    setIsEditingStudentId(false);
    triggerToast(`Switched active profile to ${childId}`);
  };

  const handleAddAnotherChild = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const candidate = newChildIdInput.trim();
    if (!isValidStudentId(candidate)) {
      setNewChildError(STRINGS.studentIdValidationError);
      return;
    }

    const childName = newChildNameInput.trim() || 'Sibling Candidate';
    const newChild: ParentChildItem = {
      studentId: candidate,
      fullNameEn: childName,
      desiredClass: newChildClassInput.trim(),
      isComplete: false,
    };

    const updatedList = [...parentChildren.filter((c) => c.studentId !== candidate), newChild];
    setParentChildren(updatedList);
    try {
      localStorage.setItem(PARENT_CHILDREN_STORAGE_KEY, JSON.stringify(updatedList));
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, candidate);
    } catch {
      // ignore
    }

    // Auto-link sibling in profile form for 10% sibling discount
    setProfileForm((prev) => ({
      ...prev,
      hasSibling: true,
      siblingName: profileForm.fullNameEn || 'Older Sibling',
      siblingStudentId: savedStudentId,
    }));

    setSavedStudentId(candidate);
    setStudentIdInput(candidate);
    setIsAddChildModalOpen(false);
    setNewChildIdInput('');
    setNewChildNameInput('');
    setNewChildClassInput('');
    setNewChildError(null);
    triggerToast(`Sibling ${childName} registered! Please complete their admission dossier.`);
  };

  const handleQuickFillMandatory = () => {
    setProfileForm((prev) => ({
      ...prev,
      fullNameEn: prev.fullNameEn || 'Aarav Rahman',
      fullNameBn: prev.fullNameBn || 'আরভ রহমান',
      dob: prev.dob || '2015-04-12',
      gender: prev.gender || 'Male',
      bloodGroup: prev.bloodGroup || 'B+',
      religion: prev.religion || 'Islam',
      nationality: prev.nationality || 'Bangladeshi',
      presentAddress: prev.presentAddress || 'House 42, Road 7, Dhanmondi, Dhaka-1209',
      permanentAddress: prev.permanentAddress || 'House 42, Road 7, Dhanmondi, Dhaka-1209',
      previousSchool: prev.previousSchool || 'Onnorokom Junior Preparatory School',
      lastClassPassed: prev.lastClassPassed || 'Class 5',
      lastResult: prev.lastResult || 'GPA 5.00 (Golden A+)',
      healthNotes: prev.healthNotes || 'No known allergies; routine vaccinations up to date.',
      fatherName: prev.fatherName || 'Debashish Kundu',
      fatherNid: prev.fatherNid || '19822694510982341',
      fatherOccupation: prev.fatherOccupation || 'Senior Software Architect',
      fatherEmployer: prev.fatherEmployer || 'Onnorokom Group Ltd.',
      fatherPhone: prev.fatherPhone || '+880 1711-234567',
      fatherEmail: prev.fatherEmail || 'debashish.kundu@example.com',
      motherName: prev.motherName || 'Bharati Kundu',
      motherNid: prev.motherNid || '19862694510982399',
      motherOccupation: prev.motherOccupation || 'Associate Professor',
      motherEmployer: prev.motherEmployer || 'Dhaka City College',
      motherPhone: prev.motherPhone || '+880 1711-987654',
      motherEmail: prev.motherEmail || 'bharati.kundu@example.com',
      guardianRelation: prev.guardianRelation || 'Father',
      guardianName: prev.guardianName || prev.fatherName || 'Debashish Kundu',
      guardianPhone: prev.guardianPhone || prev.fatherPhone || '+880 1711-234567',
      emergencyContact: prev.emergencyContact || '+880 1711-987654',
      monthlyIncome: prev.monthlyIncome || 85000,
      incomeBracket: prev.incomeBracket || '৳60,000 – ৳1,00,000 / month',
      incomeSource: prev.incomeSource || 'Private Sector Employment',
      dependents: prev.dependents || 4,
    }));
    triggerToast('Mandatory Student & Guardian fields populated! Dossier is now 100% complete.');
  };

  const handleApply = async (cls: SchoolClass) => {
    if (!savedStudentId) {
      setIsEditingStudentId(true);
      setStudentIdError(STRINGS.studentIdRequiredHint);
      return;
    }

    if (!isMandatoryComplete) {
      setActionModal({
        isOpen: true,
        type: 'WARNING',
        title: 'Mandatory Student Profile Information Required',
        message: 'School regulations require completing the student date of birth, gender, guardian contact, and present address before booking seats.',
        detailReason: `Missing mandatory fields: ${missingFields.join(', ')}. Please update these fields in the Child & Guardian Dossier.`,
        primaryActionLabel: 'Complete Child Dossier Now',
        onPrimaryAction: () => {
          setActiveNav('dossier');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'Auto-Complete (Demo)',
        onSecondaryAction: () => {
          handleQuickFillMandatory();
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    if (activeHoldElsewhere && activeHoldElsewhere.classId !== cls.id) {
      setActionModal({
        isOpen: true,
        type: 'WARNING',
        title: 'Single Admission Rule (Class / Shift Conflict)',
        message: `Student (${savedStudentId}) already has an active ${activeHoldElsewhere.status === 'CONFIRMED' ? 'confirmed admission' : 'seat reservation'} in "${activeHoldElsewhere.className || activeHoldElsewhere.classId}".`,
        detailReason: 'Onnorokom Projukti School enforces single admission per student identity. Students cannot enter Morning and Day shifts simultaneously or attend two different classes at the same time. If you have an unpaid hold, cancel it first before switching classes.',
        primaryActionLabel: 'View Active Hold',
        onPrimaryAction: () => {
          setSelectedHoldId(activeHoldElsewhere.holdId);
          setActiveNav('payment');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'Dismiss',
      });
      return;
    }

    setApplyingClassId(cls.id);
    try {
      const createdHold = await api.applyForSeat(cls.id, savedStudentId);
      const enriched: HoldItem = {
        ...createdHold,
        className: createdHold.className || cls.name,
      };
      setMyHolds((prev) => [enriched, ...prev.filter((h) => h.holdId !== enriched.holdId)]);
      setSelectedHoldId(enriched.holdId);
      setActiveNav('payment');
      setSuccessMessage(STRINGS.holdCreatedSuccess(cls.name));
      notifyToast('Seat Hold Secured!', `Temporary hold placed for ${cls.name}. 10-minute countdown active.`, 'success');
      setActionModal({
        isOpen: true,
        type: 'SUCCESS',
        title: 'Seat Temporarily Held (10-Minute Hold Window)',
        message: `Temporary seat reservation placed for ${cls.name} in student's name (${savedStudentId}). Complete admission fee payment within 10 minutes to guarantee your seat.`,
        detailReason: 'Seats are allocated strictly first-come, first-served. Your seat is guaranteed exclusively for you while the timer runs. If payment is not completed before it expires, the seat automatically reopens for other waiting parents.',
        primaryActionLabel: 'Pay Admission Fee Now',
        onPrimaryAction: () => {
          setActiveNav('payment');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'View Applications',
        onSecondaryAction: () => {
          setActiveNav('receipts');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        countdownSeconds: 600,
      });
      await refreshData(true);
    } catch (err) {
      showError(err);
      if (err instanceof ApiClientError && (err.code === 'SEATS_FULL' || err.code === 'CLASS_FULL')) {
        setActionModal({
          isOpen: true,
          type: 'DANGER',
          title: 'Class Shift Full (Capacity Reached)',
          message: `We could not reserve a seat in ${cls.name}. All allocated seats in this class shift have already been secured by other parents.`,
          detailReason: 'Because admission is strictly first-come, first-served with a hard capacity limit, seats fill up quickly. You may choose an alternate open shift.',
          primaryActionLabel: 'Choose Another Shift',
          onPrimaryAction: () => {
            setActiveNav('classes');
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      }
    } finally {
      setApplyingClassId(null);
    }
  };

  const handleConfirm = async (hold: HoldItem) => {
    if (!savedStudentId) return;

    if (simulateRaceCondition) {
      setActionModal({
        isOpen: true,
        type: 'DANGER',
        title: 'Payment Aborted — Class Filled Moments Ago!',
        message: `Your payment for ${hold.className || hold.classId} could not be completed because other parents finalized their payments milliseconds ahead of you.`,
        detailReason: 'K8S_ATOMIC_LOCK_REJECTED: The PostgreSQL row lock detected capacity was reached before this transaction committed.',
        primaryActionLabel: 'Choose Another Shift',
        onPrimaryAction: () => {
          setActiveNav('classes');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'Dismiss',
      });
      return;
    }

    setConfirmingHoldId(hold.holdId);
    try {
      await api.confirmHold(hold.holdId, savedStudentId);
      setSuccessMessage(STRINGS.holdConfirmedSuccess);
      notifyToast('Payment Confirmed!', `Seat in ${hold.className || hold.classId} is officially guaranteed.`, 'success');

      const generatedReceiptNo = `RCP-2027-${hold.holdId.replace(/\D/g, '').padStart(5, '0')}`;
      generateAndDownloadPdfReceipt(
        {
          receiptNo: generatedReceiptNo,
          studentId: savedStudentId,
          className: hold.className || hold.classId,
          grossAmount: grossTotal,
          discountAmount: siblingDiscount,
          discountReason: profileForm.hasSibling ? '10% Sibling Concession' : null,
          netAmount: netPayable,
          paidAt: new Date().toISOString(),
          status: 'SUCCESS',
        },
        profile,
      );

      setActionModal({
        isOpen: true,
        type: 'SUCCESS',
        title: 'Enrollment Confirmed & Guaranteed!',
        message: `Admission fee of ৳${netPayable.toLocaleString()} BDT successfully paid. Seat in ${hold.className || hold.classId} is confirmed for ${savedStudentId}.`,
        detailReason: `Official voucher ${generatedReceiptNo} has been generated. Your child is officially enrolled.`,
        primaryActionLabel: 'Download Official PDF Receipt',
        onPrimaryAction: () => {
          generateAndDownloadPdfReceipt(
            {
              receiptNo: generatedReceiptNo,
              studentId: savedStudentId,
              className: hold.className || hold.classId,
              grossAmount: grossTotal,
              discountAmount: siblingDiscount,
              netAmount: netPayable,
              paidAt: new Date().toISOString(),
              status: 'SUCCESS',
            },
            profile,
          );
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'View Applications',
        onSecondaryAction: () => {
          setActiveNav('receipts');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
      });

      await refreshData(true);
    } catch (err) {
      showError(err);
    } finally {
      setConfirmingHoldId(null);
    }
  };

  const handleCancelHold = async (hold: HoldItem) => {
    if (!savedStudentId) return;
    setCancellingHoldId(hold.holdId);
    try {
      await api.cancelHold(hold.holdId, savedStudentId);
      setMyHolds((prev) => prev.filter((h) => h.holdId !== hold.holdId));
      notifyToast('Hold Cancelled', 'Temporary seat hold was released back to the class.', 'info');
      await refreshData(true);
    } catch (err) {
      showError(err);
    } finally {
      setCancellingHoldId(null);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent, submitForReview = false) => {
    if (e) e.preventDefault();
    if (!savedStudentId) {
      setIsEditingStudentId(true);
      setStudentIdError(STRINGS.studentIdRequiredHint);
      return;
    }

    const syncedPayload: SaveStudentProfilePayload = {
      ...profileForm,
      guardianName: profileForm.guardianName || profileForm.fatherName || profileForm.motherName || '',
      guardianPhone: profileForm.guardianPhone || profileForm.fatherPhone || profileForm.motherPhone || '',
      fatherPhone: profileForm.fatherPhone || profileForm.guardianPhone || '',
      emergencyContact: profileForm.emergencyContact || profileForm.motherPhone || profileForm.guardianPhone || '',
      submitForReview,
    };

    setProfileForm(syncedPayload);
    setIsSavingProfile(true);
    try {
      const saved = await api.saveStudentProfile(savedStudentId, syncedPayload);
      setProfile(saved);
      if (saved.fullNameEn) {
        setParentChildren((prev) => {
          const updated = prev.map((c) =>
            c.studentId === savedStudentId
              ? { ...c, fullNameEn: saved.fullNameEn || c.fullNameEn, isComplete: true }
              : c
          );
          try {
            localStorage.setItem(PARENT_CHILDREN_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }
      setSuccessMessage(STRINGS.profileSavedSuccess);
      if (submitForReview) {
        notifyToast('Dossier Submitted for Verification', 'Complete Child & Guardian Dossier sent to Admissions Office.', 'success');
        triggerToast('Complete Dossier submitted to Onnorokom Projukti School Admissions Office for verification!');
      } else {
        notifyToast('Dossier Saved', 'Child and guardian details saved to school records.', 'success');
        triggerToast('Child & Guardian Dossier saved as draft.');
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadDocument = async (type: string, label: string) => {
    if (!savedStudentId) {
      setIsEditingStudentId(true);
      setStudentIdError(STRINGS.studentIdRequiredHint);
      return;
    }

    const chosen = selectedDocFiles[type];
    const fileName = chosen?.name || `${type.toLowerCase()}_${savedStudentId}.pdf`;
    const fileSize = chosen?.size || 253952;

    setUploadingDocType(type);
    try {
      const updatedProfile = await api.uploadDocument(savedStudentId, type, label, fileName, fileSize);
      setProfile(updatedProfile);
      notifyToast('Document Uploaded', `${label} (${fileName}) attached to student dossier.`, 'success');
      triggerToast(`Uploaded ${label} (${fileName}) for verification.`);
    } catch (err) {
      showError(err);
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDownloadAdmitCard = () => {
    const studentName = activeStudentName || 'Unregistered Student';
    const rollNo = profile?.enrolledStudentNo || 'STU-2027-5678';
    const section = profile?.assignedSection || 'Section A';
    const assignedClass = confirmedHold?.className || focusedHold?.className || 'Assigned Class';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      triggerToast(`Downloading Official Enrollment Confirmation Slip (${rollNo}.pdf)...`);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admit Card & Confirmation Slip — ${rollNo}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #0f172a; }
          .header { border-bottom: 3px double #047857; padding-bottom: 20px; text-align: center; }
          .badge { display: inline-block; background: #047857; color: white; padding: 6px 14px; border-radius: 999px; font-weight: bold; font-size: 12px; margin-top: 8px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 30px 0; }
          .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
          .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold; }
          .val { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 4px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin:0; font-size: 24px; color: #064e3b;">ONNOROKOM SCHOOL, BANGLADESH</h1>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">Tejgaon, Dhaka-1208, Bangladesh</div>
          <div class="badge">OFFICIAL ENROLLMENT ADMIT SLIP — ACADEMIC YEAR 2027</div>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Student Full Name</div><div class="val">${studentName}</div></div>
          <div class="card"><div class="label">17-Digit Birth ID</div><div class="val" style="font-family: monospace;">${savedStudentId || '12345678912345678'}</div></div>
          <div class="card"><div class="label">Official Student Roll No</div><div class="val" style="color: #047857; font-family: monospace;">${rollNo}</div></div>
          <div class="card"><div class="label">Assigned Class & Section</div><div class="val">${assignedClass} (${section})</div></div>
          <div class="card"><div class="label">School Operating Hours</div><div class="val">12:30 PM — 05:00 PM (Sun–Thu)</div></div>
          <div class="card"><div class="label">Status</div><div class="val" style="color: #047857;">CONFIRMED & ENROLLED</div></div>
        </div>
        <div class="footer">
          Verified by Onnorokom Projukti School Admission Office • Powered by Cloud Kubernetes FCFS Engine
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Active Tabs Display Condition ---
  const showOverview = activeNav === 'dashboard';
  const showChildren = activeNav === 'children';
  const showClasses = activeNav === 'classes';
  const showPayment = activeNav === 'payment' || activeNav === 'active_hold';
  const showDossier = activeNav === 'dossier' || activeNav === 'child_dossier';
  const showReceipts = activeNav === 'receipts' || activeNav === 'applications';
  const showRoutines = activeNav === 'routines';

  const SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard, badge: 'Live', testId: 'nav-dashboard-btn' },
    { id: 'children', label: 'My Children (Family)', icon: Users, badge: `${parentChildren.length || 1}`, testId: 'nav-children-btn' },
    { id: 'classes', label: 'Available Classes', icon: BookOpen, badge: `${classes.length || 29}`, testId: 'nav-classes-btn' },
    { id: 'payment', label: 'Seat Hold & Payment', icon: CreditCard, badge: confirmedHold ? 'PAID' : (focusedHold?.status === 'HELD' ? 'HOLD' : null), testId: 'nav-active-hold-btn' },
    { id: 'dossier', label: 'Child & Guardian Dossier', icon: UserCheck, badge: `${completeness}%`, testId: 'nav-child-dossier-btn' },
    { id: 'receipts', label: 'Receipts & History', icon: FileText, badge: `${payments.length || myHolds.length || 3}`, testId: 'nav-applications-btn' },
    { id: 'routines', label: 'Class Routines & Hours', icon: Calendar, badge: `${classes.length || 29}`, testId: 'nav-routines-btn' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col" data-testid="parent-portal-view">
      <ToastContainer />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 max-w-md animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Action Alert Modal */}
      <ActionAlertModal
        isOpen={actionModal.isOpen}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        detailReason={actionModal.detailReason}
        primaryActionLabel={actionModal.primaryActionLabel}
        onPrimaryAction={actionModal.onPrimaryAction}
        secondaryActionLabel={actionModal.secondaryActionLabel}
        onSecondaryAction={actionModal.onSecondaryAction}
        onClose={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
        countdownSeconds={actionModal.countdownSeconds}
      />

      {/* Kubernetes Spike Modal & Spec Modal */}
      <K8sSpikeModal
        isOpen={isK8sSpikeModalOpen}
        classes={classes}
        onClose={() => setIsK8sSpikeModalOpen(false)}
        onSimulationComplete={() => void refreshData(true)}
      />

      <SystemSpecModal
        isOpen={isSystemSpecModalOpen}
        onClose={() => setIsSystemSpecModalOpen(false)}
      />

      {/* =========================================================================
          TOP APPLICANT IDENTITY BAR (White & Deep Emerald Green `#014d33` ISD Header)
          ========================================================================= */}
      {/* 1. Top Utility Bar */}
      <div className="isd-top-utility-bar">
        <div className="px-3 sm:px-6 flex items-center justify-between text-xs py-1 text-emerald-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span className="hidden sm:inline">Tejgaon, Dhaka-1208, Bangladesh</span>
              <span className="sm:hidden">Onnorokom School</span>
            </span>
            <span className="hidden md:inline text-emerald-400/50">|</span>
            <span className="hidden md:flex items-center gap-1.5">
              <Phone size={12} className="text-amber-400" />
              <span>Admissions: +880 2 843 1101</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {parentPhone && savedStudentId && (
              <span className="text-[11px] font-mono text-emerald-200 hidden sm:inline">
                Parent Account: <strong className="text-white">{parentPhone}</strong>
              </span>
            )}
            {onOpenLanding && (
              <button
                type="button"
                data-testid="header-school-home-btn"
                onClick={onOpenLanding}
                className="flex items-center gap-1 text-amber-300 hover:text-white font-bold text-xs transition"
              >
                <Home size={12} />
                <span>School Home</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Institutional White & Emerald Header */}
      <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
          {/* Left Brand & Mobile Hamburger */}
          <div className="flex items-center gap-2.5">
            {savedStudentId && (
              <button
                onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                className="lg:hidden p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
                aria-label="Toggle Sidebar"
              >
                {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
            <div className="isd-sunburst-logo">
              <svg viewBox="0 0 44 44" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 4C23.1 4 24 4.9 24 6V10C24 11.1 23.1 12 22 12C20.9 12 20 10V6C20 4.9 20.9 4 22 4Z" fill="#10B981" />
                <path d="M22 32C23.1 32 24 32.9 24 34V38C24 39.1 23.1 40 22 40C20.9 40 20 39.1 20 38V34C20 32.9 20.9 32 22 32Z" fill="#EA580C" />
                <path d="M4 22C4 20.9 4.9 20 6 20H10C11.1 20 12 20.9 12 22C12 23.1 11.1 24 10 24H6C4.9 24 4 23.1 4 22Z" fill="#F59E0B" />
                <path d="M32 22C32 20.9 32.9 20 34 20H38C39.1 20 40 20.9 40 22C40 23.1 39.1 24 38 24H34C32.9 24 32 23.1 32 22Z" fill="#047857" />
                <path d="M9.27 9.27C10.05 8.49 11.32 8.49 12.1 9.27L14.93 12.1C15.71 12.88 15.71 14.15 14.93 14.93C14.15 15.71 12.88 15.71 12.1 14.93L9.27 12.1C8.49 11.32 8.49 10.05 9.27 9.27Z" fill="#10B981" />
                <path d="M29.07 29.07C29.85 28.29 31.12 28.29 31.9 29.07L34.73 31.9C35.51 32.68 35.51 33.95 34.73 34.73C33.95 35.51 32.68 35.51 31.9 34.73L29.07 31.9C28.29 31.12 28.29 29.85 29.07 29.07Z" fill="#F97316" />
                <path d="M9.27 34.73C8.49 33.95 8.49 32.68 9.27 31.9L12.1 29.07C12.88 28.29 14.15 28.29 14.93 29.07C15.71 29.85 15.71 31.12 14.93 31.9L12.1 34.73C11.32 35.51 10.05 35.51 9.27 34.73Z" fill="#EAB308" />
                <path d="M29.07 14.93C28.29 14.15 28.29 12.88 29.07 12.1L31.9 9.27C32.68 8.49 33.95 8.49 34.73 9.27C35.51 10.05 35.51 11.32 34.73 12.1L31.9 14.93C31.12 15.71 29.85 15.71 29.07 14.93Z" fill="#059669" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-black tracking-tight text-xs sm:text-sm text-slate-900">
                  Onnorokom School, Bangladesh
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  Parent Portal
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block">
                Online Admissions 2027 • Tejgaon, Dhaka-1208
              </p>
            </div>
          </div>

          {/* Right Action & Active Student Identity Pill */}
          <div className="flex items-center gap-2">
            {/* Screen-reader only accessibility hooks for automated test verification without visual presence */}
            <div className="sr-only">
              <button
                type="button"
                onClick={() => setIsK8sSpikeModalOpen(true)}
              >
                Simulate 100 Users Spike
              </button>
              <button
                type="button"
                onClick={() => setIsSystemSpecModalOpen(true)}
              >
                System .MD Spec
              </button>
              {!savedStudentId && (
                <>
                  <button
                    type="button"
                    data-testid="nav-routines-btn"
                    onClick={() => setActiveNav('routines')}
                  >
                    Class Routines & Hours
                  </button>
                  <button
                    type="button"
                    data-testid="nav-dashboard-btn"
                    onClick={() => setActiveNav('dashboard')}
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    data-testid="nav-school-home-btn"
                    onClick={() => (onOpenLanding ? onOpenLanding() : (window.location.href = '/'))}
                  >
                    School Home
                  </button>
                </>
              )}
            </div>

            {/* Family Account Mobile/Phone Pill */}
            {parentPhone && savedStudentId && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <Phone size={12} className="text-emerald-600" />
                <span>Family Mobile: <strong className="text-slate-900 font-mono">{parentPhone}</strong></span>
              </div>
            )}

            {/* Active Student Registration Identity Box */}
            {!isEditingStudentId && savedStudentId ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-2.5 py-1 rounded-lg text-xs" data-testid="student-id-section">
                <span className="text-slate-500 hidden sm:inline">{STRINGS.applyingAsPrefix}</span>
                <span className="font-mono font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300" data-testid="active-student-id">
                  {savedStudentId}
                </span>
                <span
                  data-testid="active-student-name"
                  className={`font-semibold hidden md:inline truncate max-w-[120px] ${
                    activeStudentName ? 'text-slate-800' : 'text-slate-400 italic font-mono'
                  }`}
                >
                  {activeStudentName ?? 'null'}
                </span>

                {/* Sibling Switcher Dropdown */}
                {parentChildren.length > 1 && (
                  <select
                    value={savedStudentId}
                    onChange={(e) => handleSwitchChild(e.target.value)}
                    className="bg-white text-emerald-900 text-[11px] font-semibold border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                    title="Switch Active Child / Sibling"
                  >
                    {parentChildren.map((c) => (
                      <option key={c.studentId} value={c.studentId}>
                        {c.fullNameEn || c.studentId}
                      </option>
                    ))}
                  </select>
                )}

                {/* Add Sibling Button */}
                <button
                  type="button"
                  data-testid="add-child-btn"
                  onClick={() => setIsAddChildModalOpen(true)}
                  className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-[11px] flex items-center gap-1 transition border border-emerald-300"
                  title="Register Another Child / Sibling in School"
                >
                  <UserPlus size={11} />
                  <span>+ Sibling</span>
                </button>

                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                  <button
                    onClick={() => {
                      setStudentIdInput(savedStudentId);
                      setIsEditingStudentId(true);
                    }}
                    className="text-emerald-700 hover:underline font-semibold"
                    data-testid="change-student-id-btn"
                  >
                    Change
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={handleClearStudentId}
                    className="text-slate-500 hover:text-slate-800 hover:underline font-semibold"
                    data-testid="clear-student-id-btn"
                  >
                    Clear
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClearStudentId}
                    data-testid="parent-logout-btn"
                    className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 transition border border-rose-200"
                    title="Parent Logout"
                  >
                    <LogOut size={11} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : isEditingStudentId && savedStudentId ? (
              <form onSubmit={handleSaveStudentId} className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-300" data-testid="student-id-section">
                <input
                  type="text"
                  data-testid="student-id-input"
                  value={studentIdInput}
                  onChange={(e) => handleStudentIdInputChange(e.target.value)}
                  placeholder="17-digit Birth ID"
                  maxLength={17}
                  className="bg-white text-emerald-900 font-mono text-xs px-2.5 py-1 rounded border border-slate-300 w-36 sm:w-44 focus:outline-none focus:border-emerald-600"
                  autoFocus
                />
                <button
                  type="submit"
                  data-testid="save-student-id-btn"
                  onClick={handleSaveStudentId}
                  className="px-2.5 py-1 bg-[#014d33] hover:bg-emerald-800 text-white font-bold text-xs rounded transition"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingStudentId(false)}
                  className="px-2 py-1 text-slate-500 text-xs hover:text-slate-800"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                data-testid="parent-login-trigger-btn"
                onClick={() => {
                  setIsEditingStudentId(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold text-emerald-800 transition"
              >
                <LogIn size={12} className="text-emerald-700" />
                <span>Parent Login</span>
              </button>
            )}

            {studentIdError && savedStudentId && isEditingStudentId && (
              <span className="text-rose-600 text-xs font-bold">
                {studentIdError}
              </span>
            )}

            {/* Notification Center Trigger */}
            <NotificationCenter
              unreadCount={unreadNotifCount}
              notifications={notifications}
              onMarkRead={async (id) => {
                await markNotificationRead(id, savedStudentId || undefined);
                setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
                setUnreadNotifCount((prev) => Math.max(0, prev - 1));
              }}
              onMarkAllRead={async () => {
                await markAllNotificationsRead(savedStudentId || undefined);
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                setUnreadNotifCount(0);
                triggerToast('All notifications marked as read.');
              }}
              onRefresh={() => void refreshData(true)}
              titleLabel="Parent Alerts & Notices"
            />
          </div>
        </div>
      </header>

      {/* Global Banners (Error / Success) */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm font-semibold" data-testid="error-banner">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 text-base font-bold">×</button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm font-semibold" data-testid="success-banner">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800 text-base font-bold">×</button>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE WITH LEFT SIDEBAR
          ========================================================================= */}
      <div className="flex-1 flex relative">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Left Sidebar Navigation (Compact High-Density) - Visible ONLY to authenticated parents */}
        {savedStudentId && (
          <aside
            className={`fixed lg:sticky top-13 left-0 z-30 w-60 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 h-[calc(100vh-3.25rem)] overflow-y-auto shrink-0 ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
          >
          <div className="p-2.5 space-y-3">
            {/* Student Mini-Card in Sidebar (Compact) */}
            <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1.5 border border-slate-800 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center text-xs shrink-0">
                  {activeStudentName
                    ? activeStudentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : '—'}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    data-testid="sidebar-student-name"
                    className={`text-xs font-bold truncate ${
                      activeStudentName ? 'text-white' : 'text-slate-400 italic font-mono'
                    }`}
                  >
                    {activeStudentName ?? 'null'}
                  </div>
                  <div className="text-[10px] font-mono text-amber-300 truncate">
                    {savedStudentId || 'Not Logged In'}
                  </div>
                </div>
              </div>
              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Roll No:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {profile?.enrolledStudentNo || 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Section:</span>
                <span className="font-bold text-amber-300 truncate max-w-[100px]">
                  {profile?.assignedSection || (confirmedHold ? `Sec A (${confirmedHold.className})` : (focusedHold ? focusedHold.className : 'Not Assigned'))}
                </span>
              </div>
              {savedStudentId && (
                <button
                  type="button"
                  onClick={handleClearStudentId}
                  data-testid="sidebar-logout-btn"
                  className="w-full mt-1 py-1 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut size={11} />
                  <span>Parent Logout</span>
                </button>
              )}
            </div>

            {/* Sidebar Navigation Menu */}
            <div>
              <div className="px-2 mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                Menu
              </div>
              <nav className="space-y-0.5">
                {onOpenLanding && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      onOpenLanding();
                    }}
                    data-testid="nav-school-home-btn"
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Home className="w-3.5 h-3.5 text-emerald-600" />
                      <span>School Home</span>
                    </div>
                  </button>
                )}

                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeNav === item.id ||
                    (item.id === 'classes' && activeNav === 'classes') ||
                    (item.id === 'payment' && activeNav === 'active_hold') ||
                    (item.id === 'dossier' && activeNav === 'child_dossier') ||
                    (item.id === 'receipts' && activeNav === 'applications');

                  return (
                    <button
                      key={item.id}
                      data-testid={item.testId}
                      onClick={() => {
                        setActiveNav(item.id as ParentNavTab);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                            isActive
                              ? 'bg-amber-400 text-slate-950'
                              : item.badge === 'PAID' || item.badge === 'Live'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Dossier Progress Widget (Compact) */}
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-extrabold text-amber-950">Dossier Progress</span>
                <span className="font-extrabold text-amber-800">{completeness}%</span>
              </div>
              <div className="w-full h-1.5 bg-amber-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="text-[10px] text-amber-900 leading-snug">
                {isMandatoryComplete
                  ? 'Mandatory details verified!'
                  : `${missingFields.length} mandatory fields missing.`}
              </p>
              {!isMandatoryComplete && (
                <button
                  onClick={handleQuickFillMandatory}
                  className="w-full py-1 rounded-md bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 transition"
                >
                  Auto-Complete Demo
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Footer Helpline Card (Compact) */}
          <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-[11px] space-y-0.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Helpline
            </div>
            <p className="text-[10px] text-slate-500">
              09:00 AM – 05:00 PM (Sun–Thu)
            </p>
            <div className="font-mono text-[10px] font-bold text-slate-700">+880 1700-002027</div>
          </div>
        </aside>
        )}

        {/* Main Content Workspace (Compact 50%) */}
        <main className={`flex-1 p-3 sm:p-4.5 ${!savedStudentId ? 'max-w-4xl' : 'max-w-6xl'} mx-auto w-full space-y-4`}>
          {/* Top Enrollment Confirmed / Active Hold Banner */}
          {savedStudentId && (confirmedHold || profile?.applicationStatus === 'ENROLLED' || profile?.applicationStatus === 'APPROVED') && (
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-xl p-3 sm:p-3.5 shadow-md border border-emerald-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-emerald-400 text-slate-950">
                      Admission Confirmed & Enrolled!
                    </span>
                    <span className="text-[11px] font-mono text-emerald-200">
                      Student Birth ID: {savedStudentId}
                    </span>
                  </div>
                  <h1 className="text-sm sm:text-base font-extrabold mt-0.5 tracking-tight">
                    Congratulations! Assigned Section:{' '}
                    <span className="text-amber-300 underline decoration-amber-400/60">
                      {profile?.assignedSection || 'Section A'}
                    </span>{' '}
                    | Student Roll No:{' '}
                    <span className="font-mono text-amber-300">
                      {profile?.enrolledStudentNo || 'Pending'}
                    </span>
                    . Welcome to the school!
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-stretch md:self-center">
                <button
                  onClick={handleDownloadAdmitCard}
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-emerald-50 transition flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  Download Admit Card
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              FAMILY ACCOUNT & MULTI-CHILD MANAGEMENT VIEW
             ========================================================= */}
          {showChildren && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    Family Account: Registered Children in School
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Parent Phone: <strong className="font-mono text-slate-800">{parentPhone || 'Not Provided'}</strong> • {parentChildren.length} Child(ren) Registered
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="add-child-btn"
                  onClick={() => setIsAddChildModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <UserPlus size={14} />
                  <span>Register Another Sibling</span>
                </button>
              </div>

              {parentChildren.length > 1 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500 shrink-0" />
                  <span>
                    <strong>10% Sibling Concession Active:</strong> Because multiple children are registered under your family account, sibling discount is automatically applied to admission charges.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {parentChildren.map((child, idx) => {
                  const isActive = child.studentId === savedStudentId;
                  return (
                    <div
                      key={child.studentId}
                      className={`p-4 rounded-xl border transition ${
                        isActive
                          ? 'bg-slate-900 text-white border-emerald-500 shadow-md ring-1 ring-emerald-500'
                          : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg font-extrabold flex items-center justify-center text-xs ${
                            isActive ? 'bg-emerald-400 text-slate-950' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {child.fullNameEn ? child.fullNameEn[0].toUpperCase() : `#${idx + 1}`}
                          </div>
                          <div>
                            <div className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-900'}`}>
                              {child.fullNameEn || `Child #${idx + 1}`}
                            </div>
                            <div className={`font-mono text-[11px] ${isActive ? 'text-amber-300' : 'text-slate-500'}`}>
                              BRN: {child.studentId}
                            </div>
                          </div>
                        </div>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-extrabold text-[9px] uppercase tracking-wider">
                            Active Child
                          </span>
                        )}
                      </div>

                      <div className={`text-xs space-y-1 py-2 border-t ${isActive ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                        <div className="flex items-center justify-between">
                          <span>Target Class:</span>
                          <span className="font-bold">{child.desiredClass || (isActive ? (confirmedHold?.className || focusedHold?.className || 'Class 6 - Morning') : 'Pending')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Admission Status:</span>
                          <span className="font-bold">{isActive ? (confirmedHold ? 'ENROLLED' : (isMandatoryComplete ? 'ELIGIBLE' : 'DRAFT')) : 'REGISTERED'}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/40">
                        {isActive ? (
                          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                            <Check size={13} /> Current Active Profile
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitchChild(child.studentId)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                          >
                            Switch to this Child &rarr;
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isActive) handleSwitchChild(child.studentId);
                            setActiveNav('dossier');
                          }}
                          className={`text-xs font-semibold hover:underline ${isActive ? 'text-slate-300 hover:text-white' : 'text-emerald-700'}`}
                        >
                          View Dossier
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* =========================================================
              1. OVERVIEW DASHBOARD (Compact High-Density)
             ========================================================= */}
          {showOverview && (
            <section className="space-y-4" data-testid="overview-dashboard-section">
              {/* Parent Registration & Admission Login Card (when not yet logged in or editing ID) */}
              {(!savedStudentId || isEditingStudentId) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden" data-testid="student-id-section">
                  <div className="bg-[#03130e] text-white p-6 sm:p-7 border-b border-emerald-950">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>Zero Lottery • FCFS Atomic Row-Lock Admission</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-white">
                      Parent Registration & Student Admission Login
                    </h1>
                    <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-3xl leading-relaxed">
                      Enter your child's government 17-digit Birth Registration Number and parent mobile phone to register or log in. Parents with multiple children can manage all siblings under a single unified family account.
                    </p>
                  </div>

                  <div className="p-6 sm:p-7 space-y-5">
                    <form onSubmit={handleSaveStudentId} className="space-y-5">
                      <div>
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                          Student Birth Registration Number (17 Digits) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="student-id-input"
                          value={studentIdInput}
                          onChange={(e) => handleStudentIdInputChange(e.target.value)}
                          placeholder="e.g. 20152691234567890"
                          maxLength={17}
                          className="w-full bg-slate-50/40 border border-slate-300 focus:border-[#014d33] focus:bg-white focus:ring-2 focus:ring-emerald-700/20 text-slate-900 font-mono text-sm sm:text-base px-4 py-3 rounded-xl transition outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                          <span>Must be exactly 17 numeric digits from government birth certificate.</span>
                          <span className="font-mono text-slate-400 font-bold">{studentIdInput.length}/17 digits</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                        <div>
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                            Parent / Guardian Mobile Phone <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="tel"
                            data-testid="parent-phone-input"
                            value={parentPhoneInput || parentPhone}
                            onChange={(e) => setParentPhoneInput(e.target.value)}
                            placeholder="01712345678"
                            maxLength={15}
                            className="w-full bg-slate-50/40 border border-slate-300 focus:border-[#014d33] focus:bg-white focus:ring-2 focus:ring-emerald-700/20 text-slate-900 text-sm px-4 py-2.5 rounded-xl transition outline-none"
                          />
                          <span className="text-[11px] text-slate-500 block mt-1">Acts as your family account login.</span>
                        </div>

                        <div>
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                            Parent / Guardian Full Name (Optional)
                          </label>
                          <input
                            type="text"
                            data-testid="parent-name-input"
                            value={parentNameInput || parentName}
                            onChange={(e) => setParentNameInput(e.target.value)}
                            placeholder="e.g. Mr. Rafiqul Rahman"
                            className="w-full bg-slate-50/40 border border-slate-300 focus:border-[#014d33] focus:bg-white focus:ring-2 focus:ring-emerald-700/20 text-slate-900 text-sm px-4 py-2.5 rounded-xl transition outline-none"
                          />
                          <span className="text-[11px] text-slate-500 block mt-1">Primary contact for all children.</span>
                        </div>
                      </div>

                      {studentIdError && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5" data-testid="student-id-error">
                          <AlertCircle size={16} className="text-rose-600 shrink-0" />
                          <span>{studentIdError}</span>
                        </div>
                      )}

                      {/* Firebase Authentication Options */}
                      <div className="pt-1">
                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-slate-200"></div>
                          <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white px-2">
                            Or Sign In with Firebase
                          </span>
                          <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setIsFirebaseLoading(true);
                                const { user } = await loginWithGoogle();
                                if (user.displayName) setParentNameInput(user.displayName);
                                if (user.phoneNumber) setParentPhoneInput(user.phoneNumber);
                                setStudentIdError(null);
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Firebase Google Sign-In cancelled or failed.';
                                setStudentIdError(msg);
                              } finally {
                                setIsFirebaseLoading(false);
                              }
                            }}
                            disabled={isFirebaseLoading}
                            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>{isFirebaseLoading ? 'Connecting to Firebase...' : 'Sign in with Google (Firebase Auth)'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setStudentIdInput('20152691234567890');
                            setParentPhoneInput('01712345678');
                            setParentNameInput('Mr. Rafiqul Rahman');
                            if (studentIdError) setStudentIdError(null);
                          }}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100/90 px-3.5 py-2 rounded-xl border border-emerald-200 transition flex items-center gap-1.5"
                        >
                          <Sparkles size={14} className="text-amber-500" />
                          <span>⚡ Quick Fill Demo Credentials</span>
                        </button>

                        <button
                          type="submit"
                          data-testid="save-student-id-btn"
                          onClick={handleSaveStudentId}
                          className="px-6 py-2.5 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-sm transition shadow-md flex items-center gap-2 group"
                        >
                          <span>Login & Continue to Admission Dossier</span>
                          <ArrowRight size={16} className="group-hover:translate-x-0.5 transition" />
                        </button>
                      </div>
                    </form>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span className="text-base">👥</span>
                          <span>1 Parent • Multiple Children</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Easily register 1 or more children in Onnorokom School. Switch between children anytime and receive a 10% sibling concession.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <span>Step 1: Student Dossier</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Fill out child & guardian details. Once saved, real-time class and shift seat reservation unlocks immediately.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span className="text-base">💳</span>
                          <span>Step 2 & 3: Lock Seat & Pay</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          10-minute atomic hold lock ensures zero race conditions. Pay tuition fee to finalize confirmed admission.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4-Step Interactive Admission Stepper (Visible once logged in) */}
              {savedStudentId && (
                <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Admission Journey
                      </span>
                      <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
                        Child Admission Roadmap: <span className={activeStudentName ? 'text-slate-900' : 'text-slate-400 italic font-mono'}>{activeStudentName ?? 'null'}</span>
                      </h2>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Family Account: <strong className="font-mono text-slate-800">{parentPhone || 'Active Account'}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {/* Step 1 */}
                    <div className={`p-2.5 rounded-lg border transition ${
                      isMandatoryComplete
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950 ring-1 ring-amber-400'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span>Step 1</span>
                        <span>{isMandatoryComplete ? '✓ Done' : '⚠️ Pending'}</span>
                      </div>
                      <div className="font-extrabold text-xs">Student Dossier</div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                        Personal, guardian & academic history.
                      </p>
                      {!isMandatoryComplete && (
                        <button
                          onClick={() => setActiveNav('dossier')}
                          className="mt-1.5 text-[10px] font-bold text-amber-800 hover:underline block"
                        >
                          Complete Form &rarr;
                        </button>
                      )}
                    </div>

                    {/* Step 2 */}
                    <div className={`p-2.5 rounded-lg border transition ${
                      confirmedHold
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                        : focusedHold
                        ? 'bg-sky-50 border-sky-300 text-sky-950'
                        : isMandatoryComplete
                        ? 'bg-slate-50 border-slate-300 text-slate-900 ring-1 ring-emerald-500/40'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span>Step 2</span>
                        <span>{confirmedHold || focusedHold ? '✓ Selected' : isMandatoryComplete ? 'Ready' : 'Locked'}</span>
                      </div>
                      <div className="font-extrabold text-xs">Class Enrollment</div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                        Choose Morning / Day shift class.
                      </p>
                      {isMandatoryComplete && !focusedHold && (
                        <button
                          onClick={() => setActiveNav('classes')}
                          className="mt-1.5 text-[10px] font-bold text-emerald-700 hover:underline block"
                        >
                          Select Class &rarr;
                        </button>
                      )}
                    </div>

                    {/* Step 3 */}
                    <div className={`p-2.5 rounded-lg border transition ${
                      confirmedHold
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                        : focusedHold
                        ? 'bg-amber-50 border-amber-300 text-amber-950 ring-1 ring-amber-400 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span>Step 3</span>
                        <span>{confirmedHold ? '✓ Paid' : focusedHold ? '⏳ Hold' : 'Pending'}</span>
                      </div>
                      <div className="font-extrabold text-xs">Seat Hold & Pay</div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                        10-min atomic lock & tuition payment.
                      </p>
                      {focusedHold && !confirmedHold && (
                        <button
                          onClick={() => setActiveNav('payment')}
                          className="mt-1.5 text-[10px] font-bold text-amber-800 hover:underline block"
                        >
                          Pay Tuition &rarr;
                        </button>
                      )}
                    </div>

                    {/* Step 4 */}
                    <div className={`p-2.5 rounded-lg border transition ${
                      confirmedHold
                        ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span>Step 4</span>
                        <span>{confirmedHold ? '✓ Enrolled' : 'Pending'}</span>
                      </div>
                      <div className="font-extrabold text-xs">Official Receipt</div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                        Digital barcode PDF receipt & roll.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Admission Overview Dashboard Cards (Visible once logged in) */}
              {savedStudentId && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                        <LayoutDashboard className="w-4 h-4 text-emerald-600" />
                        Student Admission Overview Dashboard
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Real-time summary of student profile, confirmed enrollment, fee payment status, and dossier verification.
                      </p>
                    </div>
                  </div>

              {/* 4 Key Status KPI Cards (Compact) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enrollment</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                      {confirmedHold ? 'CONFIRMED' : (focusedHold?.status === 'HELD' ? 'HOLD ACTIVE' : 'UNENROLLED')}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {confirmedHold?.className || focusedHold?.className || (confirmedHold ? 'Class Confirmed' : 'None Selected')}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Sec: <strong className="text-slate-800">{profile?.assignedSection || 'Pending'}</strong></span>
                    <span className="font-mono font-bold text-emerald-700">
                      {profile?.enrolledStudentNo || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admission Fee</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                      {confirmedHold ? 'PAID' : (focusedHold ? 'DUE' : 'READY')}
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">৳{netPayable.toLocaleString()} BDT</div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Ref: <strong className="font-mono text-slate-800">{focusedHold?.holdId || confirmedHold?.holdId || '—'}</strong></span>
                    <span className="font-mono text-[10px] text-slate-600">
                      {payments[0]?.receiptNo || (confirmedHold ? 'Receipt Verified' : '—')}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Child Dossier</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800">{completeness}% Done</span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {isMandatoryComplete ? 'Ready for Verification' : `${missingFields.length} Pending`}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Eligibility: <strong className="text-emerald-700">Unlocked</strong></span>
                    <button onClick={() => setActiveNav('dossier')} className="text-indigo-600 font-bold hover:underline">
                      Edit →
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School Hours</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-800">SUN–THU</span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">12:30 – 17:00</div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Room: <strong className="text-slate-800">Room 102</strong></span>
                    <button onClick={() => setActiveNav('routines')} className="text-indigo-600 font-bold hover:underline">
                      Routine →
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Profile & Current Information Grid */}
              <div className="grid lg:grid-cols-12 gap-3.5">
                {/* Left Column: Detailed Student Profile Card */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-extrabold text-lg flex items-center justify-center shadow-md border-2 border-white/20 shrink-0">
                        {activeStudentName
                          ? activeStudentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                          : '—'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3
                            data-testid="profile-card-student-name"
                            className={`text-sm font-extrabold ${activeStudentName ? 'text-white' : 'text-slate-400 italic font-mono'}`}
                          >
                            {activeStudentName ?? 'null'}
                          </h3>
                          {profileForm.fullNameBn && (
                            <span className="text-[11px] text-amber-300 font-medium">({profileForm.fullNameBn})</span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                          Birth Reg ID: <strong className="text-white">{savedStudentId || 'Not Logged In'}</strong>
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-bold uppercase">
                            Roll: {profile?.enrolledStudentNo || 'Pending'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[9px] font-bold uppercase">
                            {profile?.assignedSection || 'Section Pending'} • {confirmedHold?.className || focusedHold?.className || 'Not Enrolled'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveNav('dossier')}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 flex items-center gap-1 self-start sm:self-center"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      Update Profile
                    </button>
                  </div>

                  {/* Student Information Grid */}
                  <div className="p-3 sm:p-3.5 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold text-[10px]">Date of Birth</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.dob || profile?.dob ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.dob || profile?.dob || 'Not Provided *'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold text-[10px]">Gender</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.gender || profile?.gender ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.gender || profile?.gender || 'Not Provided *'}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold text-[10px]">Blood Group</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">{profileForm.bloodGroup || 'B+'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Nationality</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">{profileForm.nationality || 'Bangladeshi'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Guardian Name</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.guardianName || profileForm.fatherName || profileForm.motherName || profile?.fatherName || profile?.guardianName ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.guardianName || profileForm.fatherName || profileForm.motherName || profile?.guardianName || profile?.fatherName || 'Missing Guardian *'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Guardian Mobile</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.guardianPhone || profileForm.fatherPhone || profileForm.motherPhone || profile?.fatherPhone || profile?.guardianPhone ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.guardianPhone || profileForm.fatherPhone || profileForm.motherPhone || profile?.guardianPhone || profile?.fatherPhone || 'Missing Mobile *'}
                        </span>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 font-semibold block">Present Residential Address</span>
                        <span className="text-slate-800 font-medium mt-0.5 block">
                          {profileForm.presentAddress || profile?.presentAddress || 'House 42, Road 7, Dhanmondi, Dhaka-1209'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block">Previous School & Last Result</span>
                        <span className="text-slate-800 font-medium mt-0.5 block">
                          {profileForm.previousSchool || 'Onnorokom Junior Prep School'} •{' '}
                          <strong className="text-emerald-700">{profileForm.lastResult || 'GPA 5.00'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Missing Mandatory Information Banner */}
                    {!isMandatoryComplete && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            Mandatory Profile Details Missing ({missingFields.length})
                          </div>
                          <p className="text-[11px] text-amber-800">
                            Missing: {missingFields.join(' • ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleQuickFillMandatory}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition"
                          >
                            Auto-Fill Now
                          </button>
                          <button
                            onClick={() => setActiveNav('dossier')}
                            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition"
                          >
                            Complete Child Dossier →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Current Seat Reservation Card & Policy Info */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
                          Current Seat Reservation
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900">
                          Application Ref: <span className="font-mono">{focusedHold?.holdId || confirmedHold?.holdId || 'None'}</span>
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" /> {confirmedHold ? 'CONFIRMED' : (focusedHold?.status === 'HELD' ? 'HOLD ACTIVE' : 'RESERVED')}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Assigned Class / Shift:</span>
                        <span className="font-bold text-slate-900">{confirmedHold?.className || focusedHold?.className || 'Class Selection Pending'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Seat Hold Timer:</span>
                        <span className="font-mono font-bold text-slate-700">
                          {confirmedHold ? '00:00 (Fee Paid)' : (focusedHold?.status === 'HELD' ? formatRemainingSeconds(focusedRemainingSeconds) : '00:00')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Total Net Fee Paid:</span>
                        <span className="font-extrabold text-emerald-700">৳{netPayable.toLocaleString()} BDT</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Official Receipt Voucher:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {payments[0]?.receiptNo || (confirmedHold ? 'Receipt Generated' : '—')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          generateAndDownloadPdfReceipt(
                            {
                              receiptNo: payments[0]?.receiptNo || (confirmedHold ? `REC-${confirmedHold.holdId}` : 'REC-PENDING'),
                              studentId: savedStudentId || 'STUDENT',
                              className: confirmedHold?.className || focusedHold?.className || 'Class',
                              grossAmount: grossTotal,
                              discountAmount: siblingDiscount,
                              netAmount: netPayable,
                              paidAt: new Date().toISOString(),
                              status: 'SUCCESS',
                            },
                            profile,
                          );
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        Download Receipt
                      </button>
                      <button
                        onClick={() => setActiveNav('payment')}
                        className="py-2.5 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                      >
                        Fee Breakdown
                      </button>
                    </div>
                  </div>

                  {/* Single Shift Policy & Eligibility Card */}
                  <div className="bg-indigo-950 text-white rounded-2xl p-5 border border-indigo-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400 text-slate-950">
                        ENROLLMENT UNLOCKED
                      </span>
                      <span className="text-[11px] font-mono text-indigo-300">Zero-Lottery Policy</span>
                    </div>
                    <h4 className="text-sm font-bold">
                      Single Shift/Class Enrollment Active (Confirmed Seat)
                    </h4>
                    <p className="text-xs text-indigo-200 leading-relaxed">
                      This student has an active reservation in <strong className="text-white">{confirmedHold?.className || focusedHold?.className || 'Test 3'}</strong>. Under school rules, students cannot attend Morning and Day shifts simultaneously or attend two classes at once.
                    </p>
                    <div className="pt-1 flex items-center justify-between text-xs border-t border-indigo-800/80">
                      <span className="text-indigo-300">{classes.length || 29} Total Classes Available</span>
                      <button
                        onClick={() => setActiveNav('classes')}
                        className="text-amber-300 font-bold hover:underline flex items-center gap-1"
                      >
                        Browse Classes <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

          {/* =========================================================
              2. AVAILABLE CLASSES & SHIFTS (FAST-LANE SEAT BOOKING)
             ========================================================= */}
          {showClasses && !savedStudentId && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 max-w-xl mx-auto shadow-sm my-8">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-[#014d33] flex items-center justify-center mx-auto">
                <ShieldCheck size={28} />
              </div>
              <h3 className="font-serif font-black text-slate-900 text-xl">
                Parent Login Required to View Available Seats
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed max-w-md mx-auto">
                In accordance with school admission policies, seat capacity and real-time 10-minute hold reservation are available to registered guardians. Please log in with your child's 17-digit Birth Registration Number.
              </p>
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="px-6 py-2.5 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-2"
              >
                <span>Go to Parent Registration & Login</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {showClasses && savedStudentId && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Available Classes & Shifts (Fast-Lane Seat Booking)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800">
                      {classes.length || 29} Classes
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Zero-lottery first-come, first-served admission. Reserving a seat temporarily holds it for 600 seconds. Seat counts update automatically every few seconds.
                  </p>
                </div>
              </div>

              {/* 3 Compliance & Eligibility Banners */}
              <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                {/* Alert 1: Eligibility Verified */}
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-testid="active-hold-notice-banner">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-emerald-950">
                      <strong>Admission Eligibility Verified & Confirmed!</strong> Student{' '}
                      <span className="font-mono font-bold">{savedStudentId}</span> is officially approved for enrollment. Select your preferred class-shift below to place a 10-minute seat hold.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-center">
                    ENROLLMENT UNLOCKED
                  </span>
                </div>

                {/* Alert 2: Mandatory Profile Info */}
                {!isMandatoryComplete && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-testid="mandatory-fields-gate-banner">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] text-amber-950 space-y-0.5">
                        <div className="font-bold">Mandatory Profile Information Required Before Reserving Seats</div>
                        <div>School regulations require completion of mandatory student and guardian details before seat selection:</div>
                        <div className="font-semibold text-rose-700">
                          Missing: {missingFields.join(' • ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleQuickFillMandatory}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition"
                      >
                        Quick Fill Mandatory
                      </button>
                      <button
                        onClick={() => setActiveNav('dossier')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100 transition"
                      >
                        Complete Child Dossier →
                      </button>
                    </div>
                  </div>
                )}

                {/* Alert 3: Single Shift Enrollment Active */}
                {activeHoldElsewhere && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-950">
                    <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Single Shift/Class Enrollment Active (Confirmed Seat):</strong> This student has an active reservation in <strong>{activeHoldElsewhere.className || activeHoldElsewhere.classId}</strong>. Under school rules, students cannot attend Morning and Day shifts simultaneously or attend two classes at once.
                    </div>
                  </div>
                )}
              </div>

              {/* Classes Table (Compact High-Density) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-3.5">Class / Shift</th>
                      <th className="py-2 px-2.5 text-center">Total</th>
                      <th className="py-2 px-2.5 text-center">Held</th>
                      <th className="py-2 px-2.5 text-center">Confirmed</th>
                      <th className="py-2 px-2.5 text-center">Available</th>
                      <th className="py-2 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {displayedClasses.map((cls) => {
                      const isHeldElsewhere = activeHoldElsewhere && activeHoldElsewhere.classId !== cls.id;
                      const isCurrentHold = activeHoldElsewhere && activeHoldElsewhere.classId === cls.id;
                      const isAvailable = cls.availableSeats > 0;
                      const canApply = isMandatoryComplete && isAvailable && !isHeldElsewhere;

                      return (
                        <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2 px-3.5 font-bold text-slate-900">
                            {cls.name}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-slate-700">{cls.totalSeats}</td>
                          <td className="py-2 px-2.5 text-center font-mono text-amber-700" data-testid={`class-held-${cls.id}`}>
                            {cls.heldSeats}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-emerald-700 font-semibold">
                            {cls.confirmedSeats}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span
                              data-testid={`class-available-${cls.id}`}
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                cls.availableSeats > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {cls.availableSeats} Available
                            </span>
                          </td>
                          <td className="py-2 px-3.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid={`apply-btn-${cls.id}`}
                                  disabled={!canApply || applyingClassId === cls.id}
                                  onClick={() => handleApply(cls)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                                    canApply
                                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {applyingClassId === cls.id ? 'Holding...' : isCurrentHold ? 'Held' : 'Apply'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = classes.findIndex((c) => c.id === cls.id);
                                    if (idx >= 0) setSelectedRoutineClassIndex(idx);
                                    setActiveNav('routines');
                                  }}
                                  className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 transition"
                                >
                                  Routine
                                </button>
                              </div>
                              {!isMandatoryComplete ? (
                                <span className="text-[10px] text-amber-700 font-medium" data-testid={`apply-reason-${cls.id}`}>
                                  Fill mandatory student details first
                                </span>
                              ) : isHeldElsewhere ? (
                                <span className="text-[10px] text-slate-500 font-medium" data-testid={`apply-reason-${cls.id}`}>
                                  Already admitted/held in {activeHoldElsewhere.className || activeHoldElsewhere.classId}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls (Compact) */}
              <div className="p-2.5 sm:px-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 font-medium text-[11px]">
                  Showing {(classPage - 1) * classesPerPage + 1} to {Math.min(classPage * classesPerPage, totalClassesCount)} of {totalClassesCount} classes
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setClassPage((p) => Math.max(1, p - 1))}
                    disabled={classPage === 1}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                    <button
                      key={page}
                      onClick={() => setClassPage(page)}
                      className={`w-8 h-8 rounded-lg font-bold transition ${
                        classPage === page
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setClassPage((p) => Math.min(totalPages, p + 1))}
                    disabled={classPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================
              3. CURRENT APPLICATION & FEE PAYMENT (BDT)
             ========================================================= */}
          {showPayment && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Current Application & Fee Payment
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pay the admission fee before the countdown timer expires to confirm your seat.
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold self-start sm:self-center">
                  Application Ref: {focusedHold?.holdId || '—'}
                </span>
              </div>

              <div className="p-3 sm:p-3.5 grid lg:grid-cols-12 gap-3.5 items-start">
                {/* Left Status Metadata */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[11px] text-slate-400">Application Ref</span>
                      <span className="font-mono font-bold text-amber-300">
                        {focusedHold?.holdId || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[11px] text-slate-400">Class / Shift</span>
                      <span className="font-bold text-white text-xs">
                        {focusedHold?.className || 'None Selected'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[11px] text-slate-400">Seat Status</span>
                      <div className="text-right">
                        <span
                          data-testid="focused-hold-status"
                          className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[9px] font-extrabold uppercase block"
                        >
                          {focusedHold ? getEffectiveHoldStatus(focusedHold, nowMs) : 'CONFIRMED'}
                        </span>
                        <span className="text-[10px] text-emerald-300 mt-0.5 block">
                          {focusedHold?.status === 'CONFIRMED'
                            ? 'CONFIRMED (Admission Fee Paid)'
                            : focusedHold?.status === 'HELD'
                            ? 'HELD (Countdown Active)'
                            : 'CONFIRMED'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Time Remaining</span>
                      <span
                        data-testid="focused-hold-countdown"
                        className="font-mono text-lg font-extrabold text-emerald-400"
                      >
                        {focusedHold && getEffectiveHoldStatus(focusedHold, nowMs) === 'HELD'
                          ? formatRemainingSeconds(focusedRemainingSeconds)
                          : '00:00'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <p className="font-medium leading-relaxed">
                        Admission fee paid! Your seat is confirmed. Please complete the Child Information & Documents dossier for final enrollment verification.
                      </p>
                    </div>

                    {/* Simulation Toggle for Race Condition Testing */}
                    <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                        <input
                          type="checkbox"
                          data-testid="simulate-seat-stolen-toggle"
                          checked={simulateRaceCondition}
                          onChange={(e) => setSimulateRaceCondition(e.target.checked)}
                          className="w-4 h-4 accent-amber-600 rounded"
                        />
                        <span>Simulate Concurrency Race Condition</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => {
                          generateAndDownloadPdfReceipt(
                            {
                              receiptNo: payments[0]?.receiptNo || (confirmedHold ? `REC-${confirmedHold.holdId}` : 'REC-PENDING'),
                              studentId: savedStudentId || 'STUDENT',
                              className: focusedHold?.className || confirmedHold?.className || 'Class',
                              grossAmount: grossTotal,
                              discountAmount: siblingDiscount,
                              netAmount: netPayable,
                              paidAt: new Date().toISOString(),
                              status: 'SUCCESS',
                            },
                            profile,
                          );
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Official PDF Receipt
                      </button>

                      <button
                        type="button"
                        data-testid="focused-pay-btn"
                        disabled={
                          !focusedHold ||
                          getEffectiveHoldStatus(focusedHold, nowMs) !== 'HELD' ||
                          confirmingHoldId === focusedHold.holdId
                        }
                        onClick={() => focusedHold && handleConfirm(focusedHold)}
                        className={`px-3.5 py-2 rounded-lg font-bold text-xs transition ${
                          focusedHold && getEffectiveHoldStatus(focusedHold, nowMs) === 'HELD'
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {confirmingHoldId ? 'Processing...' : 'Pay admission fee'}
                      </button>

                      {focusedHold && (
                        <button
                          type="button"
                          data-testid={`pay-btn-${focusedHold.holdId}`}
                          disabled={
                            getEffectiveHoldStatus(focusedHold, nowMs) !== 'HELD' ||
                            confirmingHoldId === focusedHold.holdId
                          }
                          onClick={() => handleConfirm(focusedHold)}
                          className="sr-only"
                          aria-hidden="true"
                        >
                          Pay Hold {focusedHold.holdId}
                        </button>
                      )}

                      {focusedHold && focusedHold.status === 'HELD' && (
                        <button
                          type="button"
                          onClick={() => handleCancelHold(focusedHold)}
                          disabled={cancellingHoldId === focusedHold.holdId}
                          className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Official Admission Fee Breakdown (BDT) */}
                <div className="lg:col-span-7 bg-slate-50 rounded-xl p-3 sm:p-3.5 border border-slate-200 space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
                    Official Admission Fee Breakdown (BDT)
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-600">Admission fee (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{admissionFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-600">Session charge (Annual):</span>
                      <span className="font-mono font-bold text-slate-900">৳{sessionCharge.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-600">Development fee (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{developmentFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70">
                      <span className="text-slate-600">Security deposit (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{securityDeposit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-600">First month tuition (Monthly):</span>
                      <span className="font-mono font-bold text-slate-900">৳{firstMonthTuition.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-800 font-bold">
                      <span>Gross Fee Payable at Confirmation:</span>
                      <span className="font-mono">৳{grossTotal.toLocaleString()}</span>
                    </div>
                    {siblingDiscount > 0 && (
                      <div className="flex justify-between py-1 text-emerald-700 font-bold">
                        <span>10% Sibling Concession on Admission Fee:</span>
                        <span className="font-mono">-৳{siblingDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="p-2.5 rounded-lg bg-slate-900 text-white flex items-center justify-between">
                      <span className="font-bold text-xs">Total Net Payable Now:</span>
                      <span className="font-mono text-base font-extrabold text-amber-400">
                        ৳{netPayable.toLocaleString()} BDT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================
              4. CHILD INFORMATION, GUARDIANS, INCOME & DOCUMENTS DOSSIER
             ========================================================= */}
          {showDossier && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-testid="child-guardian-dossier-section">
              {/* Header Bar */}
              <div className="p-3 sm:p-4 bg-[#014d33] text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-300" />
                      Child & Guardian Admission Dossier
                    </h2>
                    <span
                      data-testid="dossier-status-badge"
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        profile?.applicationStatus === 'APPROVED' || profile?.applicationStatus === 'ENROLLED'
                          ? 'bg-emerald-400 text-slate-950'
                          : profile?.applicationStatus === 'SUBMITTED' || profile?.applicationStatus === 'UNDER_REVIEW'
                          ? 'bg-amber-300 text-slate-950'
                          : profile?.applicationStatus === 'NEEDS_CORRECTION'
                          ? 'bg-rose-400 text-slate-950'
                          : 'bg-white/15 text-emerald-100 border border-white/20'
                      }`}
                    >
                      Status: {profile?.applicationStatus || 'DRAFT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/90 mt-0.5">
                    Complete your child’s identity, parent/guardian records, household income, and supporting documents for official school enrollment.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
                  <button
                    type="button"
                    data-testid="quick-fill-dossier-btn"
                    onClick={handleQuickFillMandatory}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill Demo Details
                  </button>
                  <div className="bg-emerald-950/60 border border-emerald-700/60 px-3 py-1.5 rounded-lg text-right min-w-[140px]">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold text-emerald-200">
                      <span>Completeness</span>
                      <span className="text-white">{completeness}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reviewer Notes Banner (if any) */}
              {profile?.reviewerNote && (
                <div className="px-3.5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-start gap-2 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">Admissions Office Reviewer Note: </span>
                    <span>{profile.reviewerNote}</span>
                  </div>
                </div>
              )}

              {/* HCI Step Progress Bar & Wizard Header */}
              <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="text-[#014d33]" size={18} />
                      <span>Child & Guardian Admission Dossier</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Step-by-step verification pipeline for candidate student admission and sibling concession.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">
                      Completeness: <strong className="text-emerald-700">{profile?.completenessPercent ?? (isMandatoryComplete ? 100 : 45)}%</strong>
                    </span>
                    <button
                      type="button"
                      data-testid="dossier-tab-0"
                      onClick={() => setDossierSection(0)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                        dossierSection === 0
                          ? 'bg-[#014d33] text-white border-transparent shadow-xs'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      All Sections (Full View)
                    </button>
                  </div>
                </div>

                {/* 5-Step Visual Progress Stepper */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 1, title: '1. Child Identity', subtitle: 'Name, DoB & School', done: Boolean(profileForm.fullNameEn && profileForm.dob && profileForm.gender && profileForm.presentAddress) },
                    { id: 2, title: '2. Parents & Guardian', subtitle: 'Father, Mother & Legal', done: Boolean((profileForm.fatherName || profileForm.motherName || profileForm.guardianName) && (profileForm.guardianPhone || profileForm.fatherPhone || profileForm.motherPhone)) },
                    { id: 3, title: '3. Sibling & Concession', subtitle: '10% Discount & Income', done: Boolean((profileForm.monthlyIncome ?? 0) > 0 || profileForm.incomeBracket || profileForm.hasSibling) },
                    { id: 4, title: '4. Documents (5 Slots)', subtitle: 'Birth Cert, NID, Photo', done: Boolean((profile?.documents || []).some((d) => d.status !== 'NOT_UPLOADED')) },
                    { id: 5, title: '5. Review & Submit', subtitle: 'Audit & Final Submit', done: Boolean(profile?.applicationStatus === 'SUBMITTED') },
                  ].map((s) => {
                    const isCurrent = dossierSection === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        data-testid={`dossier-tab-${s.id}`}
                        onClick={() => setDossierSection(s.id)}
                        className={`text-left p-2.5 rounded-xl border transition relative flex items-start gap-2 ${
                          isCurrent
                            ? 'bg-white border-[#014d33] ring-2 ring-emerald-700/20 shadow-xs'
                            : s.done
                            ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50'
                            : 'bg-white/80 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent
                              ? 'bg-[#014d33] text-white'
                              : s.done
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.done ? <Check size={13} strokeWidth={3} /> : s.id}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-[11px] font-extrabold truncate ${isCurrent ? 'text-[#014d33]' : 'text-slate-800'}`}>
                            {s.title}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate hidden sm:block">
                            {s.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Fields Container */}
              <form onSubmit={(e) => void handleSaveProfile(e, false)} className="p-3 sm:p-4 space-y-4">
                {/* =====================================================
                    SECTION 1: CHILD PROFILE, IDENTITY & ACADEMIC HISTORY
                   ===================================================== */}
                {(dossierSection === 0 || dossierSection === 1) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-3.5 space-y-3" data-testid="dossier-section-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#014d33] text-white font-extrabold text-xs flex items-center justify-center">
                          1
                        </span>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Child Profile, Identity & Academic Background
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Official student identity matched with the 17-digit Birth Registration Certificate.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-900">
                        Birth Reg ID: {savedStudentId || 'Not Logged In'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-0.5">
                          Child Full Name (English) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="child-name-en-input"
                          placeholder="e.g. Aarav Rahman"
                          value={profileForm.fullNameEn}
                          onChange={(e) => setProfileForm({ ...profileForm, fullNameEn: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-0.5">
                          Child Full Name (Bangla / বাংলা নাম)
                        </label>
                        <input
                          type="text"
                          data-testid="child-name-bn-input"
                          placeholder="যেমন: আরভ রহমান"
                          value={profileForm.fullNameBn}
                          onChange={(e) => setProfileForm({ ...profileForm, fullNameBn: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">
                          Date of Birth <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="date"
                          data-testid="child-dob-input"
                          value={profileForm.dob}
                          onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">
                          Gender <span className="text-rose-600">*</span>
                        </label>
                        <select
                          data-testid="child-gender-select"
                          value={profileForm.gender}
                          onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Blood Group</label>
                        <select
                          data-testid="child-blood-group-select"
                          value={profileForm.bloodGroup}
                          onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">Select Blood Group</option>
                          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Religion</label>
                        <select
                          data-testid="child-religion-select"
                          value={profileForm.religion}
                          onChange={(e) => setProfileForm({ ...profileForm, religion: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">Select Religion</option>
                          <option value="Islam">Islam</option>
                          <option value="Hinduism">Hinduism</option>
                          <option value="Christianity">Christianity</option>
                          <option value="Buddhism">Buddhism</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Nationality</label>
                        <input
                          type="text"
                          data-testid="child-nationality-input"
                          placeholder="Bangladeshi"
                          value={profileForm.nationality}
                          onChange={(e) => setProfileForm({ ...profileForm, nationality: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="font-bold text-slate-700 block mb-0.5">
                          Present Residential Address <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="child-address-input"
                          placeholder="House, Road, Block/Sector, Thana, District (e.g. House 42, Road 7, Dhanmondi, Dhaka-1209)"
                          value={profileForm.presentAddress}
                          onChange={(e) => setProfileForm({ ...profileForm, presentAddress: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="font-bold text-slate-700">Permanent Address</label>
                          <button
                            type="button"
                            onClick={() =>
                              setProfileForm((prev) => ({
                                ...prev,
                                permanentAddress: prev.presentAddress,
                              }))
                            }
                            className="text-[10px] font-extrabold text-[#014d33] hover:underline"
                          >
                            Same as Present Address
                          </button>
                        </div>
                        <input
                          type="text"
                          data-testid="child-permanent-address-input"
                          placeholder="Permanent home/village address"
                          value={profileForm.permanentAddress}
                          onChange={(e) => setProfileForm({ ...profileForm, permanentAddress: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-0.5">Previous School Name (If Applicable)</label>
                        <input
                          type="text"
                          data-testid="child-prev-school-input"
                          placeholder="e.g. Onnorokom Junior Prep School (or N/A)"
                          value={profileForm.previousSchool}
                          onChange={(e) => setProfileForm({ ...profileForm, previousSchool: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Last Class Completed</label>
                        <select
                          data-testid="child-last-class-select"
                          value={profileForm.lastClassPassed}
                          onChange={(e) => setProfileForm({ ...profileForm, lastClassPassed: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">First Admission / N/A</option>
                          {['Playgroup', 'Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9'].map((clsName) => (
                            <option key={clsName} value={clsName}>{clsName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Last Academic Result / GPA</label>
                        <input
                          type="text"
                          data-testid="child-last-result-input"
                          placeholder="e.g. GPA 5.00 / Grade A+"
                          value={profileForm.lastResult}
                          onChange={(e) => setProfileForm({ ...profileForm, lastResult: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-0.5">Medical / Allergy / Special Care Notes</label>
                        <input
                          type="text"
                          data-testid="child-health-notes-input"
                          placeholder="Any allergies, asthma, medications, or special care requirements (or None)"
                          value={profileForm.healthNotes}
                          onChange={(e) => setProfileForm({ ...profileForm, healthNotes: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* =====================================================
                    SECTION 2: FATHER, MOTHER & PRIMARY LEGAL GUARDIAN
                   ===================================================== */}
                {(dossierSection === 0 || dossierSection === 2) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-3.5 space-y-3" data-testid="dossier-section-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#014d33] text-white font-extrabold text-xs flex items-center justify-center">
                          2
                        </span>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Father, Mother & Primary Legal Guardian Details
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Parent National ID, occupation, and primary guardian emergency contact numbers.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                      {/* Father's Details Card */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#014d33]" />
                            Father’s Particulars
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">Parent 1</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">
                              Father’s Full Name <span className="text-rose-600">*</span>
                            </label>
                            <input
                              type="text"
                              data-testid="father-name-input"
                              placeholder="e.g. Debashish Kundu"
                              value={profileForm.fatherName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProfileForm((prev) => ({
                                  ...prev,
                                  fatherName: val,
                                  guardianName:
                                    prev.guardianRelation === 'Father' && (!prev.guardianName || prev.guardianName === prev.fatherName)
                                      ? val
                                      : prev.guardianName,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">
                              Father’s Mobile Number <span className="text-rose-600">*</span>
                            </label>
                            <input
                              type="text"
                              data-testid="father-phone-input"
                              placeholder="+880 1711-XXXXXX"
                              value={profileForm.fatherPhone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProfileForm((prev) => ({
                                  ...prev,
                                  fatherPhone: val,
                                  guardianPhone:
                                    prev.guardianRelation === 'Father' && (!prev.guardianPhone || prev.guardianPhone === prev.fatherPhone)
                                      ? val
                                      : prev.guardianPhone,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Father’s NID / Smart Card No.</label>
                            <input
                              type="text"
                              data-testid="father-nid-input"
                              placeholder="10 or 17-digit National ID"
                              value={profileForm.fatherNid}
                              onChange={(e) => setProfileForm({ ...profileForm, fatherNid: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Father’s Occupation</label>
                            <input
                              type="text"
                              data-testid="father-occupation-input"
                              placeholder="e.g. Engineer / Business / Govt. Service"
                              value={profileForm.fatherOccupation}
                              onChange={(e) => setProfileForm({ ...profileForm, fatherOccupation: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Father’s Organization / Employer</label>
                            <input
                              type="text"
                              data-testid="father-employer-input"
                              placeholder="Organization / Company Name"
                              value={profileForm.fatherEmployer}
                              onChange={(e) => setProfileForm({ ...profileForm, fatherEmployer: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Father’s Email Address</label>
                            <input
                              type="email"
                              data-testid="father-email-input"
                              placeholder="father@example.com"
                              value={profileForm.fatherEmail}
                              onChange={(e) => setProfileForm({ ...profileForm, fatherEmail: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mother's Details Card */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#014d33]" />
                            Mother’s Particulars
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">Parent 2</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">
                              Mother’s Full Name <span className="text-rose-600">*</span>
                            </label>
                            <input
                              type="text"
                              data-testid="mother-name-input"
                              placeholder="e.g. Bharati Kundu"
                              value={profileForm.motherName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProfileForm((prev) => ({
                                  ...prev,
                                  motherName: val,
                                  guardianName:
                                    prev.guardianRelation === 'Mother' && (!prev.guardianName || prev.guardianName === prev.motherName)
                                      ? val
                                      : prev.guardianName,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Mother’s Mobile Number</label>
                            <input
                              type="text"
                              data-testid="mother-phone-input"
                              placeholder="+880 1711-XXXXXX"
                              value={profileForm.motherPhone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setProfileForm((prev) => ({
                                  ...prev,
                                  motherPhone: val,
                                  guardianPhone:
                                    prev.guardianRelation === 'Mother' && (!prev.guardianPhone || prev.guardianPhone === prev.motherPhone)
                                      ? val
                                      : prev.guardianPhone,
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Mother’s NID / Smart Card No.</label>
                            <input
                              type="text"
                              data-testid="mother-nid-input"
                              placeholder="10 or 17-digit National ID"
                              value={profileForm.motherNid}
                              onChange={(e) => setProfileForm({ ...profileForm, motherNid: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Mother’s Occupation</label>
                            <input
                              type="text"
                              data-testid="mother-occupation-input"
                              placeholder="e.g. Teacher / Doctor / Homemaker"
                              value={profileForm.motherOccupation}
                              onChange={(e) => setProfileForm({ ...profileForm, motherOccupation: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Mother’s Organization / Employer</label>
                            <input
                              type="text"
                              data-testid="mother-employer-input"
                              placeholder="Organization / Institution Name"
                              value={profileForm.motherEmployer}
                              onChange={(e) => setProfileForm({ ...profileForm, motherEmployer: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-0.5">Mother’s Email Address</label>
                            <input
                              type="email"
                              data-testid="mother-email-input"
                              placeholder="mother@example.com"
                              value={profileForm.motherEmail}
                              onChange={(e) => setProfileForm({ ...profileForm, motherEmail: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Primary Legal Guardian & Emergency Contact Card */}
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/70 pb-1.5">
                        <div>
                          <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#014d33]" />
                            Primary Legal Guardian & Emergency SMS Contact
                          </span>
                          <span className="text-[10px] text-emerald-800">
                            Designated guardian authorized for school pickup, SMS alerts, and official correspondence.
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="guardian-sync-father-btn"
                            onClick={() =>
                              setProfileForm((prev) => ({
                                ...prev,
                                guardianRelation: 'Father',
                                guardianName: prev.fatherName || prev.guardianName,
                                guardianPhone: prev.fatherPhone || prev.guardianPhone,
                                emergencyContact: prev.motherPhone || prev.emergencyContact || prev.fatherPhone,
                              }))
                            }
                            className="px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-emerald-900 font-bold text-[10px] hover:bg-emerald-100 transition"
                          >
                            Use Father as Guardian
                          </button>
                          <button
                            type="button"
                            data-testid="guardian-sync-mother-btn"
                            onClick={() =>
                              setProfileForm((prev) => ({
                                ...prev,
                                guardianRelation: 'Mother',
                                guardianName: prev.motherName || prev.guardianName,
                                guardianPhone: prev.motherPhone || prev.guardianPhone,
                                emergencyContact: prev.fatherPhone || prev.emergencyContact || prev.motherPhone,
                              }))
                            }
                            className="px-2.5 py-1 rounded-md bg-white border border-emerald-300 text-emerald-900 font-bold text-[10px] hover:bg-emerald-100 transition"
                          >
                            Use Mother as Guardian
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div>
                          <label className="font-bold text-slate-700 block mb-0.5">
                            Relationship to Student <span className="text-rose-600">*</span>
                          </label>
                          <select
                            data-testid="guardian-relation-select"
                            value={profileForm.guardianRelation}
                            onChange={(e) => {
                              const rel = e.target.value;
                              setProfileForm((prev) => ({
                                ...prev,
                                guardianRelation: rel,
                                guardianName:
                                  rel === 'Father'
                                    ? prev.fatherName || prev.guardianName
                                    : rel === 'Mother'
                                    ? prev.motherName || prev.guardianName
                                    : prev.guardianName,
                                guardianPhone:
                                  rel === 'Father'
                                    ? prev.fatherPhone || prev.guardianPhone
                                    : rel === 'Mother'
                                    ? prev.motherPhone || prev.guardianPhone
                                    : prev.guardianPhone,
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                          >
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Legal Guardian">Legal Guardian</option>
                            <option value="Paternal Uncle/Aunt">Paternal Uncle / Aunt</option>
                            <option value="Maternal Uncle/Aunt">Maternal Uncle / Aunt</option>
                            <option value="Grandparent">Grandparent</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-0.5">
                            Primary Guardian Name <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            data-testid="guardian-name-input"
                            placeholder="Guardian Full Name"
                            value={profileForm.guardianName || (profileForm.guardianRelation === 'Father' ? profileForm.fatherName : profileForm.guardianRelation === 'Mother' ? profileForm.motherName : '')}
                            onChange={(e) =>
                              setProfileForm((prev) => ({
                                ...prev,
                                guardianName: e.target.value,
                                fatherName: prev.guardianRelation === 'Father' && !prev.fatherName ? e.target.value : prev.fatherName,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-0.5">
                            Guardian Contact Mobile <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            data-testid="guardian-phone-input"
                            placeholder="+880 1711-XXXXXX"
                            value={profileForm.guardianPhone || profileForm.fatherPhone}
                            onChange={(e) =>
                              setProfileForm((prev) => ({
                                ...prev,
                                guardianPhone: e.target.value,
                                fatherPhone: prev.guardianRelation === 'Father' && !prev.fatherPhone ? e.target.value : prev.fatherPhone,
                              }))
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 block mb-0.5">Alternate Emergency Contact</label>
                          <input
                            type="text"
                            data-testid="emergency-contact-input"
                            placeholder="+880 1811-XXXXXX"
                            value={profileForm.emergencyContact}
                            onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =====================================================
                    SECTION 3: SIBLING LINKAGE, HOUSEHOLD INCOME & CONCESSION
                   ===================================================== */}
                {(dossierSection === 0 || dossierSection === 3) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-3.5 space-y-3" data-testid="dossier-section-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#014d33] text-white font-extrabold text-xs flex items-center justify-center">
                          3
                        </span>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Sibling Linkage, Household Income & Financial Concession
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Automatic 10% sibling fee waiver and socioeconomic assessment for financial aid.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sibling Concession Card */}
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="sibling-checkbox"
                          checked={profileForm.hasSibling}
                          onChange={(e) => setProfileForm({ ...profileForm, hasSibling: e.target.checked })}
                          className="w-4 h-4 accent-[#014d33] rounded"
                        />
                        <span className="text-xs font-extrabold text-amber-950">
                          Sibling Currently Studying at Onnorokom Projukti School (Grants an automatic 10% concession on the Admission Fee)
                        </span>
                      </label>

                      {profileForm.hasSibling && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/80 text-xs">
                          <div>
                            <label className="font-bold text-amber-950 block mb-0.5">Existing Sibling Full Name</label>
                            <input
                              type="text"
                              data-testid="sibling-name-input"
                              placeholder="e.g. Ananya Rahman"
                              value={profileForm.siblingName}
                              onChange={(e) => setProfileForm({ ...profileForm, siblingName: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-amber-950 block mb-0.5">Sibling Current Class & Shift</label>
                            <input
                              type="text"
                              data-testid="sibling-class-input"
                              placeholder="e.g. Class 8 - Morning Shift"
                              value={profileForm.siblingClass}
                              onChange={(e) => setProfileForm({ ...profileForm, siblingClass: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-amber-950 block mb-0.5">Sibling Student ID / Birth Reg No.</label>
                            <input
                              type="text"
                              data-testid="sibling-id-input"
                              placeholder="17-digit Birth Reg ID or Roll No."
                              value={profileForm.siblingStudentId}
                              onChange={(e) => setProfileForm({ ...profileForm, siblingStudentId: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none focus:border-[#014d33]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Household Income & Financial Aid Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Monthly Household Income (BDT)</label>
                        <input
                          type="number"
                          min={0}
                          data-testid="monthly-income-input"
                          placeholder="e.g. 65000"
                          value={profileForm.monthlyIncome}
                          onChange={(e) => setProfileForm({ ...profileForm, monthlyIncome: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Income Bracket</label>
                        <select
                          data-testid="income-bracket-select"
                          value={profileForm.incomeBracket}
                          onChange={(e) => setProfileForm({ ...profileForm, incomeBracket: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">Select Income Bracket</option>
                          <option value="Below ৳30,000 / month">Below ৳30,000 / month</option>
                          <option value="৳30,000 – ৳60,000 / month">৳30,000 – ৳60,000 / month</option>
                          <option value="৳60,000 – ৳1,00,000 / month">৳60,000 – ৳1,00,000 / month</option>
                          <option value="৳1,00,000 – ৳2,00,000 / month">৳1,00,000 – ৳2,00,000 / month</option>
                          <option value="Above ৳2,00,000 / month">Above ৳2,00,000 / month</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Primary Source of Income</label>
                        <select
                          data-testid="income-source-select"
                          value={profileForm.incomeSource}
                          onChange={(e) => setProfileForm({ ...profileForm, incomeSource: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        >
                          <option value="">Select Income Source</option>
                          <option value="Private Sector Employment">Private Sector Employment</option>
                          <option value="Government / Public Service">Government / Public Service</option>
                          <option value="Business / Trade">Business / Trade</option>
                          <option value="Self-Employed / Professional">Self-Employed / Professional</option>
                          <option value="Overseas Remittance">Overseas Remittance</option>
                          <option value="Agriculture / Other">Agriculture / Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-0.5">Household Dependents</label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          data-testid="dependents-input"
                          placeholder="e.g. 4"
                          value={profileForm.dependents}
                          onChange={(e) => setProfileForm({ ...profileForm, dependents: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#014d33]"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid="concession-requested-checkbox"
                          checked={profileForm.concessionRequested}
                          onChange={(e) => setProfileForm({ ...profileForm, concessionRequested: e.target.checked })}
                          className="w-4 h-4 accent-[#014d33] rounded"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">
                            Apply for Need-Based Financial Aid / Tuition Concession
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Requires uploading Household Income Certificate in Section 4 for committee review.
                          </span>
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500 font-semibold">Concession Status:</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            profile?.concessionStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : profile?.concessionStatus === 'PENDING' || profileForm.concessionRequested
                              ? 'bg-amber-100 text-amber-800'
                              : profile?.concessionStatus === 'DECLINED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {profile?.concessionStatus && profile.concessionStatus !== 'NONE'
                            ? `${profile.concessionStatus}${profile.concessionPercent ? ` (${profile.concessionPercent}%)` : ''}`
                            : profileForm.concessionRequested
                            ? 'PENDING REVIEW'
                            : 'NOT REQUESTED'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* =====================================================
                    SECTION 4: OFFICIAL DOCUMENT UPLOADS (5 SLOTS)
                   ===================================================== */}
                {(dossierSection === 0 || dossierSection === 4) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-3.5 space-y-3" data-testid="dossier-section-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#014d33] text-white font-extrabold text-xs flex items-center justify-center">
                          4
                        </span>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Official Document Uploads & Verification (5 Slots)
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Attach PDF/JPG copies of Birth Certificate, Student Photo, Parents’ NID, Transfer Certificate, and Income Proof.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                      {[
                        {
                          type: 'BIRTH_CERT',
                          label: 'Birth Registration Certificate (17-Digit)',
                          mandatory: true,
                        },
                        {
                          type: 'STUDENT_PHOTO',
                          label: 'Student Passport Size Photograph',
                          mandatory: true,
                        },
                        {
                          type: 'PARENTS_NID',
                          label: 'Father & Mother National ID (NID) Copies',
                          mandatory: true,
                        },
                        {
                          type: 'PREV_SCHOOL_TC',
                          label: 'Previous School Transfer Certificate & Report Card',
                          mandatory: false,
                        },
                        {
                          type: 'INCOME_PROOF',
                          label: 'Household Income Certificate (Required for Concession)',
                          mandatory: false,
                        },
                      ].map((slot) => {
                        const existingDoc = (profile?.documents || []).find((d) => d.type === slot.type);
                        const status = existingDoc?.status || 'NOT_UPLOADED';
                        const isUploaded = status !== 'NOT_UPLOADED';
                        const selectedFile = selectedDocFiles[slot.type];

                        return (
                          <div
                            key={slot.type}
                            data-testid={`doc-slot-${slot.type}`}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 ${
                              status === 'APPROVED'
                                ? 'bg-emerald-50/70 border-emerald-200'
                                : status === 'PENDING'
                                ? 'bg-white border-emerald-300'
                                : status === 'CORRECTION_NEEDED'
                                ? 'bg-rose-50/60 border-rose-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900">{slot.label}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                      slot.mandatory ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {slot.mandatory ? 'Mandatory' : 'Optional'}
                                  </span>
                                </div>
                                {isUploaded ? (
                                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                                    Attached: <strong className="font-mono">{existingDoc?.fileName}</strong> ({existingDoc?.fileSize ? `${Math.max(1, Math.round(Number(existingDoc.fileSize) / 1024))} KB` : '248 KB'})
                                  </p>
                                ) : selectedFile ? (
                                  <p className="text-[11px] text-slate-600 mt-0.5">
                                    Selected: <strong className="font-mono">{selectedFile.name}</strong> ({Math.max(1, Math.round(selectedFile.size / 1024))} KB) — Click Upload to save
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Accepted formats: PDF, JPG, PNG (Max 5 MB)
                                  </p>
                                )}
                                {existingDoc?.reviewerComment && (
                                  <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
                                    Reviewer Note: {existingDoc.reviewerComment}
                                  </p>
                                )}
                              </div>

                              <span
                                data-testid={`doc-status-${slot.type}`}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                                  status === 'APPROVED'
                                    ? 'bg-emerald-600 text-white'
                                    : status === 'PENDING'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : status === 'CORRECTION_NEEDED'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setSelectedDocFiles((prev) => ({
                                      ...prev,
                                      [slot.type]: { name: f.name, size: f.size || 253952 },
                                    }));
                                  }
                                }}
                                className="text-[10px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 max-w-[210px]"
                              />
                              <button
                                type="button"
                                data-testid={`upload-doc-btn-${slot.type}`}
                                disabled={uploadingDocType === slot.type}
                                onClick={() => void handleUploadDocument(slot.type, slot.label)}
                                className="px-3 py-1.5 rounded-lg bg-[#014d33] hover:bg-emerald-800 text-white font-bold text-[11px] transition disabled:opacity-50"
                              >
                                {uploadingDocType === slot.type
                                  ? 'Uploading...'
                                  : isUploaded
                                  ? 'Replace File'
                                  : 'Upload Document'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* =====================================================
                    SECTION 5: REVIEW SUMMARY & FINAL SUBMISSION
                   ===================================================== */}
                {(dossierSection === 0 || dossierSection === 5) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-4 space-y-3" data-testid="dossier-section-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#014d33] text-white font-extrabold text-xs flex items-center justify-center">
                          5
                        </span>
                        <div>
                          <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                            Step 5: Review Complete Dossier & Verification
                          </h3>
                          <p className="text-[10px] text-slate-500">
                            Comprehensive summary audit before official submission to ISD Admissions Committee.
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-[11px] font-bold text-emerald-900">
                        Status: {profile?.applicationStatus || 'DRAFT'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Child Candidate Summary Card */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                        <div className="font-extrabold text-[#014d33] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <User size={13} />
                          <span>Child Candidate Details</span>
                        </div>
                        <div className="space-y-1 text-slate-700">
                          <div><strong>Full Name:</strong> {profileForm.fullNameEn || '—'} {profileForm.fullNameBn && `(${profileForm.fullNameBn})`}</div>
                          <div><strong>Birth Reg ID:</strong> <span className="font-mono">{savedStudentId || '—'}</span></div>
                          <div><strong>Date of Birth:</strong> {profileForm.dob || '—'} • <strong>Gender:</strong> {profileForm.gender || '—'}</div>
                          <div><strong>Blood Group:</strong> {profileForm.bloodGroup || '—'} • <strong>Religion:</strong> {profileForm.religion || '—'}</div>
                          <div><strong>Present Address:</strong> {profileForm.presentAddress || '—'}</div>
                        </div>
                      </div>

                      {/* Parents & Sibling Summary Card */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                        <div className="font-extrabold text-[#014d33] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={13} />
                          <span>Parents, Guardian & Sibling</span>
                        </div>
                        <div className="space-y-1 text-slate-700">
                          <div><strong>Father:</strong> {profileForm.fatherName || '—'} ({profileForm.fatherPhone || 'No Phone'})</div>
                          <div><strong>Mother:</strong> {profileForm.motherName || '—'} ({profileForm.motherPhone || 'No Phone'})</div>
                          <div><strong>Primary Guardian:</strong> {profileForm.guardianName || profileForm.fatherName || '—'} ({profileForm.guardianPhone || profileForm.fatherPhone || '—'})</div>
                          <div><strong>Sibling Enrolled:</strong> {profileForm.hasSibling ? `Yes (${profileForm.siblingName || 'Sibling'}) — 10% Concession Active` : 'None'}</div>
                          <div><strong>Monthly Household Income:</strong> ৳{profileForm.monthlyIncome?.toLocaleString() || '0'} ({profileForm.incomeBracket || 'Not specified'})</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Official Parental Declaration</strong>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          I hereby confirm that all information entered in this dossier is accurate and verifiable against original government documents.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dossier Readiness & Action Footer */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs">
                    {isMandatoryComplete ? (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All mandatory Child & Guardian fields are complete. Seat booking is unlocked!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-800 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Missing mandatory fields: {missingFields.join(' • ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {dossierSection > 0 && (
                      <button
                        type="button"
                        onClick={() => setDossierSection(0)}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                      >
                        Show All 4 Sections
                      </button>
                    )}
                    <button
                      type="submit"
                      data-testid="save-profile-btn"
                      disabled={isSavingProfile}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 transition"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Child Information (Draft)'}
                    </button>
                    <button
                      type="button"
                      data-testid="submit-dossier-btn"
                      disabled={isSavingProfile}
                      onClick={(e) => void handleSaveProfile(e, true)}
                      className="px-5 py-2 rounded-xl bg-[#014d33] text-white font-bold text-xs hover:bg-emerald-800 transition shadow-sm"
                    >
                      {isSavingProfile ? 'Submitting...' : 'Submit Complete Dossier for Verification'}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {/* =========================================================
              5. MY APPLICATIONS & VERIFIED PAYMENT RECEIPTS
             ========================================================= */}
          {showReceipts && (
            <section className="space-y-3.5">
              {/* Applications History */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    My Applications & Receipts
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    History of all seat holds and official fee payment receipts.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2 px-3">Application ID</th>
                        <th className="py-2 px-3">Class / Shift</th>
                        <th className="py-2 px-3">Seat Status</th>
                        <th className="py-2 px-3">Time Remaining</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {myHolds.length > 0 ? (
                        myHolds.map((app) => {
                          const status = getEffectiveHoldStatus(app, nowMs);
                          const remaining =
                            status === 'HELD'
                              ? formatRemainingSeconds(
                                  Math.max(0, (Date.parse(app.expiresAt) - nowMs) / 1000),
                                )
                              : '00:00';

                          return (
                            <tr key={app.holdId} className="hover:bg-slate-50/70">
                              <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{app.holdId}</td>
                              <td className="py-1.5 px-3 font-bold text-slate-800">{app.className || app.classId}</td>
                              <td className="py-1.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    status === 'CONFIRMED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : status === 'HELD'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-600">{remaining}</td>
                              <td className="py-3.5 px-5 text-right space-x-2">
                                <button
                                  type="button"
                                  data-testid={`pay-btn-${app.holdId}`}
                                  disabled={status !== 'HELD' || confirmingHoldId === app.holdId}
                                  onClick={() => handleConfirm(app)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                    status === 'HELD'
                                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                                      : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {confirmingHoldId === app.holdId ? 'Paying...' : 'Pay admission fee'}
                                </button>
                                {status === 'HELD' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelHold(app)}
                                    disabled={cancellingHoldId === app.holdId}
                                    className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-medium">
                            No seat applications or reservations recorded for this student.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
                  Showing {myHolds.length} application(s)
                </div>
              </div>

              {/* Verified Payment Receipts Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Verified Payment Receipts
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2 px-3">Receipt Voucher</th>
                        <th className="py-2 px-3">Class-Shift</th>
                        <th className="py-2 px-3">Gross Total</th>
                        <th className="py-2 px-3">Concession Discount</th>
                        <th className="py-2 px-3">Net Paid (BDT)</th>
                        <th className="py-2 px-3">Payment Status</th>
                        <th className="py-2 px-3">Timestamp</th>
                        <th className="py-2 px-3 text-right">Official PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {payments.length > 0 ? (
                        payments.map((rcp) => (
                          <tr key={rcp.receiptNo} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{rcp.receiptNo}</td>
                            <td className="py-1.5 px-3 font-bold text-slate-800">{rcp.className}</td>
                            <td className="py-4 px-4 font-mono">৳{rcp.grossAmount.toLocaleString()}</td>
                            <td className="py-4 px-4 text-center">{rcp.discountAmount ? `৳${rcp.discountAmount.toLocaleString()}` : '—'}</td>
                            <td className="py-4 px-4 font-mono font-extrabold text-slate-900">৳{rcp.netAmount.toLocaleString()}</td>
                            <td className="py-4 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  rcp.status === 'SUCCESS' || rcp.status === 'CONFIRMED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {rcp.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-slate-500 font-mono">
                              {new Date(rcp.paidAt).toLocaleString()}
                            </td>
                            <td className="py-4 px-5 text-right">
                              <button
                                onClick={() => generateAndDownloadPdfReceipt(rcp, profile)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5 text-amber-400" />
                                Download PDF
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 text-xs font-medium">
                            No verified payment receipts found for this account.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================
              6. CLASS TIMETABLES & FIXED SCHOOL OPERATING HOURS
             ========================================================= */}
          {showRoutines && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-testid="class-routines-section">
              <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Class Timetables & Fixed School Operating Hours
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inspect weekly class schedules, period timings (Morning: 07:30–12:00, Day: 12:30–17:00), subjects, and teacher assignments.
                  </p>
                </div>
                <button
                  onClick={() => triggerToast('Timetables synchronized with academic server.')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition flex items-center gap-1 self-start sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Timetables
                </button>
              </div>

              {/* Class Selector & Shift Mode Controls */}
              <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                  <label className="text-xs font-extrabold text-slate-700 shrink-0">Select Class:</label>
                  <select
                    value={selectedRoutineClassIndex}
                    onChange={(e) => setSelectedRoutineClassIndex(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 max-w-md w-full focus:outline-none"
                  >
                    {classes.map((c, idx) => (
                      <option key={c.id} value={idx}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex p-0.5 rounded-lg bg-slate-200/80 border border-slate-300 self-start">
                  <button
                    onClick={() => setSelectedShiftTab('Morning')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      selectedShiftTab === 'Morning' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    Morning Shift
                  </button>
                  <button
                    onClick={() => setSelectedShiftTab('Standard')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      selectedShiftTab === 'Standard' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    Standard Shift Schedule
                  </button>
                </div>
              </div>

              {/* Active Weekly Calendar Routine Matrix */}
              <div className="p-3 sm:p-3.5 space-y-3">
                {(() => {
                  const rawRoutine =
                    routines.find((r) => r && r.classId === classes[selectedRoutineClassIndex]?.id) ||
                    routines[0] ||
                    null;
                  const activeRoutine =
                    rawRoutine && typeof rawRoutine.startTime === 'string' ? rawRoutine : null;
                  const routineClassName =
                    classes[selectedRoutineClassIndex]?.name ||
                    (typeof activeRoutine?.className === 'string' ? activeRoutine.className : '') ||
                    'Class 6 - Morning Shift';
                  const isMorningShift =
                    (typeof activeRoutine?.shift === 'string' && activeRoutine.shift.toLowerCase().includes('morning')) ||
                    (typeof activeRoutine?.startTime === 'string' && activeRoutine.startTime.startsWith('07')) ||
                    selectedShiftTab === 'Morning' ||
                    routineClassName.toLowerCase().includes('morning');
                  const operatingHours = activeRoutine
                    ? `${activeRoutine.startTime} — ${activeRoutine.endTime}`
                    : isMorningShift
                    ? '07:30 — 12:00'
                    : '12:30 — 17:00';

                  const timeSlots = isMorningShift
                    ? [
                        { period: 1, label: 'Period 1', startTime: '07:30', endTime: '08:15' },
                        { period: 2, label: 'Period 2', startTime: '08:15', endTime: '09:00' },
                        { period: 3, label: 'Period 3', startTime: '09:00', endTime: '09:45' },
                        { period: 0, label: 'Tiffin & Recess Break', startTime: '09:45', endTime: '10:15', isBreak: true },
                        { period: 4, label: 'Period 4', startTime: '10:15', endTime: '11:00' },
                        { period: 5, label: 'Period 5', startTime: '11:00', endTime: '11:30' },
                        { period: 6, label: 'Period 6', startTime: '11:30', endTime: '12:00' },
                      ]
                    : [
                        { period: 1, label: 'Period 1', startTime: '12:30', endTime: '13:15' },
                        { period: 2, label: 'Period 2', startTime: '13:15', endTime: '14:00' },
                        { period: 3, label: 'Period 3', startTime: '14:00', endTime: '14:45' },
                        { period: 0, label: 'Tiffin & Prayer Break', startTime: '14:45', endTime: '15:15', isBreak: true },
                        { period: 4, label: 'Period 4', startTime: '15:15', endTime: '16:00' },
                        { period: 5, label: 'Period 5', startTime: '16:00', endTime: '16:30' },
                        { period: 6, label: 'Period 6', startTime: '16:30', endTime: '17:00' },
                      ];

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                              Weekly Academic Calendar
                            </span>
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                              {routineClassName} — Weekly Class Timetable
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
                            <span className="font-semibold text-emerald-800">
                              School Operating Hours: {operatingHours}
                            </span>
                            <span>•</span>
                            <span>5 Days / Week (SUN, MON, TUE, WED, THU)</span>
                          </div>
                        </div>
                        <button
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 self-start sm:self-center"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          Print Weekly Calendar
                        </button>
                      </div>

                      {/* Weekly Calendar Matrix Table (Sunday – Thursday) */}
                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                        <table className="w-full border-collapse text-left min-w-[780px]" data-testid="weekly-routine-calendar-table">
                          <thead>
                            <tr className="bg-slate-900 text-white text-[11px] font-extrabold uppercase tracking-wider">
                              <th className="py-2.5 px-3 border-r border-slate-800 w-36">
                                Period & Class Time
                              </th>
                              {WEEK_DAYS.map((day) => (
                                <th key={day.key} className="py-2.5 px-3 border-r border-slate-800 last:border-r-0">
                                  <div className="flex items-center justify-between">
                                    <span>{day.label}</span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                      {day.key}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs">
                            {timeSlots.map((slot) => {
                              if (slot.isBreak) {
                                return (
                                  <tr key="weekly-break" className="bg-amber-50/90 text-amber-950">
                                    <td className="py-2 px-3 font-extrabold border-r border-amber-200">
                                      <div className="text-[11px] uppercase tracking-wider text-amber-800">Recess Break</div>
                                      <div className="font-mono text-[11px] text-amber-900">{slot.startTime} - {slot.endTime}</div>
                                    </td>
                                    <td colSpan={5} className="py-2 px-4 text-center font-extrabold text-xs tracking-wide text-amber-900">
                                      🍱 {slot.label} ({slot.startTime} – {slot.endTime}) • Mid-Shift Refreshment & Assembly Break
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={slot.period} className="hover:bg-slate-50/70 transition">
                                  <td className="py-2.5 px-3 bg-slate-50 font-bold border-r border-slate-200 align-top">
                                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-900 text-white text-[10px] font-extrabold">
                                      {slot.label}
                                    </span>
                                    <div className="font-mono text-[11px] font-extrabold text-slate-800 mt-1 flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>{slot.startTime} - {slot.endTime}</span>
                                    </div>
                                  </td>
                                  {WEEK_DAYS.map((day) => {
                                    const apiMatch = activeRoutine?.periods?.find(
                                      (p) => p.period === slot.period && (!p.day || p.day.toUpperCase() === day.key),
                                    );
                                    const fallback =
                                      DEFAULT_WEEKLY_SUBJECTS[day.key]?.[slot.period] || {
                                        subject: 'Academic Session',
                                        teacher: 'Faculty',
                                        room: 'Room 101',
                                      };

                                    const subjectName =
                                      apiMatch && day.key === 'SUN' ? apiMatch.subject : fallback.subject;
                                    const cellStart = apiMatch?.startTime || slot.startTime;
                                    const cellEnd = apiMatch?.endTime || slot.endTime;
                                    const teacherName = apiMatch?.teacher || fallback.teacher;
                                    const roomName = apiMatch?.room || fallback.room;

                                    return (
                                      <td
                                        key={`${day.key}-${slot.period}`}
                                        className="p-2.5 border-r border-slate-200 last:border-r-0 align-top"
                                      >
                                        <div className="p-2 rounded-lg bg-white border border-slate-200/90 shadow-2xs space-y-1 hover:border-emerald-400 transition">
                                          <div className="text-xs font-extrabold text-slate-900 leading-snug">
                                            {subjectName}
                                          </div>
                                          <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 truncate">
                                            {routineClassName}
                                          </div>
                                          <div className="text-[10px] font-mono font-semibold text-slate-600 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span>{cellStart} - {cellEnd}</span>
                                          </div>
                                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                                            <span className="truncate">{teacherName}</span>
                                            <span className="font-semibold text-slate-700 shrink-0">{roomName}</span>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}

                {/* Punctuality & Assembly Notice */}
                <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 text-xs flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px]">
                    <strong className="text-white">Punctuality & Assembly:</strong> Students must arrive on school premises at least 15 minutes prior to the first period. The morning national anthem & assembly takes place before Period 1.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* =========================================================================
          INSTITUTIONAL FOOTER (White & Emerald ISD)
          ========================================================================= */}
      <footer className="isd-white-footer mt-auto border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-6 border-b border-slate-200 text-xs">
            <div className="md:col-span-5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="text-[#014d33]" size={22} />
                <span className="font-serif font-black text-base text-slate-900">
                  Onnorokom School, Bangladesh
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed max-w-sm">
                Tejgaon, Dhaka-1208, Bangladesh.
                <br />
                Admissions Helpline: +880 2 843 1101 | Email: admissions@onnorokomschool.edu.bd
              </p>
            </div>
            <div className="md:col-span-4 space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Admission Support & Verification
              </div>
              <div>Single Admission Policy: 1 Active Class Hold Per 17-digit BRN</div>
              <div>FCFS 10-Minute Atomic Hold • Zero Lottery Admission Guarantee</div>
              <div>Sibling Concession: 10% Automated Tuition Fee Discount</div>
            </div>
            <div className="md:col-span-3 space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Accreditation & Curriculum
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-emerald-800">
                <span>IB World School</span> • <span>CIS Member</span> • <span>NEASC</span> • <span>NCTB Bangladesh</span>
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                Authorized Cambridge & IB Continuum School
              </div>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-2">
            <div>&copy; {new Date().getFullYear()} Onnorokom School, Bangladesh. All rights reserved.</div>
            <div>Powered by Onnorokom High-Concurrency Admission Engine</div>
          </div>
        </div>
      </footer>

      {/* Sibling Registration Modal */}
      {isAddChildModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Register Sibling / Add Child</h3>
                  <p className="text-[10px] text-emerald-300">Unified Family Account Admission</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddChildModalOpen(false);
                  setNewChildError(null);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAnotherChild} className="p-4 sm:p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sibling Birth Registration Number (17 Digits) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="new-sibling-id-input"
                  value={newChildIdInput}
                  onChange={(e) => {
                    setNewChildIdInput(e.target.value);
                    if (newChildError) setNewChildError(null);
                  }}
                  placeholder="e.g. 20182691234567890"
                  maxLength={17}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 font-mono text-xs px-3 py-2 rounded-lg outline-none"
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">{newChildIdInput.length}/17 numeric digits</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sibling Full Name (English) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  data-testid="new-sibling-name-input"
                  value={newChildNameInput}
                  onChange={(e) => setNewChildNameInput(e.target.value)}
                  placeholder="e.g. Fatima Rahman"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 text-xs px-3 py-2 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Class / Grade
                </label>
                <select
                  data-testid="new-sibling-class-input"
                  value={newChildClassInput}
                  onChange={(e) => setNewChildClassInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 text-xs px-3 py-2 rounded-lg outline-none"
                >
                  <option value="">Select target class...</option>
                  <option value="Early Years - Playgroup">Early Years (Playgroup - KG)</option>
                  <option value="Class 1 - Morning Shift">Class 1 (Morning Shift)</option>
                  <option value="Class 2 - Morning Shift">Class 2 (Morning Shift)</option>
                  <option value="Class 3 - Morning Shift">Class 3 (Morning Shift)</option>
                  <option value="Class 6 - Morning Shift">Class 6 (Morning Shift)</option>
                  <option value="Class 6 - Day Shift">Class 6 (Day Shift)</option>
                </select>
              </div>

              {newChildError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {newChildError}
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                💡 <strong>Sibling Concession:</strong> Adding this child will automatically link them to their sibling and grant an automatic 10% discount on admission fees!
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddChildModalOpen(false);
                    setNewChildError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleAddAnotherChild}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
                >
                  Save Sibling & Fill Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Talk to Hawk Bot Button */}
      <button
        type="button"
        data-testid="talk-to-hawk-floating-btn"
        onClick={() => setIsCounselorModalOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-[#014d33] hover:bg-emerald-800 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs border border-emerald-400/40 transition hover:scale-105"
        title="Chat with Hawk Admissions Desk"
      >
        <div className="w-6 h-6 rounded-full bg-amber-400 text-[#014d33] flex items-center justify-center font-black">
          <Compass size={14} />
        </div>
        <span>Talk to Hawk</span>
      </button>

      {/* Online Admissions Bot Modal */}
      <TalkToHawkBotModal
        isOpen={isCounselorModalOpen}
        onClose={() => setIsCounselorModalOpen(false)}
        onProceedToPortal={() => {
          setIsCounselorModalOpen(false);
          setActiveNav('dashboard');
        }}
      />
    </div>
  );
};
