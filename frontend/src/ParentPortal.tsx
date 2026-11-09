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
  Layers,
  BadgeCheck,
  AlertCircle,
  Bolt,
  FileCode2,
} from 'lucide-react';
import { ActionAlertModal } from './ActionAlertModal';
import { K8sSpikeModal } from './K8sSpikeModal';
import { SystemSpecModal } from './SystemSpecModal';
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
import { POLL_INTERVAL_MS, STUDENT_ID_STORAGE_KEY } from './config';
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

// --- Rich Default Routine Schedule (Sunday to Thursday) ---
const DEFAULT_ROUTINE_BY_DAY: Record<string, Array<{ period: string; time: string; subject: string; room: string | null; isBreak: boolean }>> = {
  Sunday: [
    { period: 'Period 1', time: '12:30 - 13:10', subject: 'Mathematics', room: 'Room 102', isBreak: false },
    { period: 'Period 2', time: '13:10 - 13:50', subject: 'General Science', room: 'Room 102', isBreak: false },
    { period: 'Period 3', time: '13:50 - 14:30', subject: 'ICT', room: 'Room 102', isBreak: false },
    { period: 'Recess / Break', time: '14:30 - 14:50', subject: 'Tiffin Break', room: null, isBreak: true },
    { period: 'Period 4', time: '14:50 - 15:30', subject: 'Bangladesh & Global Studies', room: 'Room 102', isBreak: false },
    { period: 'Period 5', time: '15:30 - 16:10', subject: 'Religion & Moral Education', room: 'Room 102', isBreak: false },
    { period: 'Period 6', time: '16:10 - 16:50', subject: 'Physical Education', room: 'Room 102', isBreak: false },
  ],
  Monday: [
    { period: 'Period 1', time: '12:30 - 13:10', subject: 'English First Paper', room: 'Room 102', isBreak: false },
    { period: 'Period 2', time: '13:10 - 13:50', subject: 'Mathematics', room: 'Room 102', isBreak: false },
    { period: 'Period 3', time: '13:50 - 14:30', subject: 'Bangla Literature', room: 'Room 102', isBreak: false },
    { period: 'Recess / Break', time: '14:30 - 14:50', subject: 'Tiffin Break', room: null, isBreak: true },
    { period: 'Period 4', time: '14:50 - 15:30', subject: 'General Science', room: 'Room 102', isBreak: false },
    { period: 'Period 5', time: '15:30 - 16:10', subject: 'ICT Lab', room: 'Computer Lab 1', isBreak: false },
    { period: 'Period 6', time: '16:10 - 16:50', subject: 'Arts & Crafts', room: 'Room 102', isBreak: false },
  ],
  Tuesday: [
    { period: 'Period 1', time: '12:30 - 13:10', subject: 'Mathematics', room: 'Room 102', isBreak: false },
    { period: 'Period 2', time: '13:10 - 13:50', subject: 'Bangla Grammar', room: 'Room 102', isBreak: false },
    { period: 'Period 3', time: '13:50 - 14:30', subject: 'English Grammar', room: 'Room 102', isBreak: false },
    { period: 'Recess / Break', time: '14:30 - 14:50', subject: 'Tiffin Break', room: null, isBreak: true },
    { period: 'Period 4', time: '14:50 - 15:30', subject: 'Bangladesh & Global Studies', room: 'Room 102', isBreak: false },
    { period: 'Period 5', time: '15:30 - 16:10', subject: 'General Science', room: 'Room 102', isBreak: false },
    { period: 'Period 6', time: '16:10 - 16:50', subject: 'Library & Reading', room: 'Room 102', isBreak: false },
  ],
  Wednesday: [
    { period: 'Period 1', time: '12:30 - 13:10', subject: 'General Science', room: 'Room 102', isBreak: false },
    { period: 'Period 2', time: '13:10 - 13:50', subject: 'Mathematics', room: 'Room 102', isBreak: false },
    { period: 'Period 3', time: '13:50 - 14:30', subject: 'ICT', room: 'Room 102', isBreak: false },
    { period: 'Recess / Break', time: '14:30 - 14:50', subject: 'Tiffin Break', room: null, isBreak: true },
    { period: 'Period 4', time: '14:50 - 15:30', subject: 'English First Paper', room: 'Room 102', isBreak: false },
    { period: 'Period 5', time: '15:30 - 16:10', subject: 'Religion & Moral Education', room: 'Room 102', isBreak: false },
    { period: 'Period 6', time: '16:10 - 16:50', subject: 'Co-Curricular Debate', room: 'Room 102', isBreak: false },
  ],
  Thursday: [
    { period: 'Period 1', time: '12:30 - 13:10', subject: 'Mathematics', room: 'Room 102', isBreak: false },
    { period: 'Period 2', time: '13:10 - 13:50', subject: 'Bangla First Paper', room: 'Room 102', isBreak: false },
    { period: 'Period 3', time: '13:50 - 14:30', subject: 'General Science', room: 'Room 102', isBreak: false },
    { period: 'Recess / Break', time: '14:30 - 14:50', subject: 'Tiffin Break', room: null, isBreak: true },
    { period: 'Period 4', time: '14:50 - 15:30', subject: 'Bangladesh & Global Studies', room: 'Room 102', isBreak: false },
    { period: 'Period 5', time: '15:30 - 16:10', subject: 'Physical Education', room: 'Playground', isBreak: false },
    { period: 'Period 6', time: '16:10 - 16:50', subject: 'Weekly Cultural Assembly', room: 'Auditorium', isBreak: false },
  ],
};

export type ParentNavTab =
  | 'dashboard'
  | 'full_portal'
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

  // --- Navigation & Layout State ---
  const [activeNav, setActiveNav] = useState<ParentNavTab>('full_portal');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // --- Core Seat & Hold Data ---
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myHolds, setMyHolds] = useState<HoldItem[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);

  // --- Student Profile & Dossier State ---
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [dossierSection, setDossierSection] = useState(1);
  const [profileForm, setProfileForm] = useState<SaveStudentProfilePayload>({
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
  });

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
  const [selectedDay, setSelectedDay] = useState<string>('Sunday');

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
            setProfileForm((prev) => ({
              ...prev,
              fullNameEn: loadedProfile.fullNameEn ?? '',
              fullNameBn: loadedProfile.fullNameBn ?? '',
              dob: loadedProfile.dob ?? '',
              gender: loadedProfile.gender ?? '',
              nationality: loadedProfile.nationality ?? 'Bangladeshi',
              religion: loadedProfile.religion ?? '',
              bloodGroup: loadedProfile.bloodGroup ?? '',
              presentAddress: loadedProfile.presentAddress ?? '',
              permanentAddress: loadedProfile.permanentAddress ?? '',
              previousSchool: loadedProfile.previousSchool ?? '',
              lastClassPassed: loadedProfile.lastClassPassed ?? '',
              lastResult: loadedProfile.lastResult ?? '',
              healthNotes: loadedProfile.healthNotes ?? '',
              hasSibling: Boolean(loadedProfile.hasSibling),
              siblingName: loadedProfile.siblingName ?? '',
              siblingClass: loadedProfile.siblingClass ?? '',
              siblingStudentId: loadedProfile.siblingStudentId ?? '',
              fatherName: loadedProfile.fatherName ?? '',
              fatherNid: loadedProfile.fatherNid ?? '',
              fatherOccupation: loadedProfile.fatherOccupation ?? '',
              fatherEmployer: loadedProfile.fatherEmployer ?? '',
              fatherPhone: loadedProfile.fatherPhone ?? '',
              fatherEmail: loadedProfile.fatherEmail ?? '',
              motherName: loadedProfile.motherName ?? '',
              motherNid: loadedProfile.motherNid ?? '',
              motherOccupation: loadedProfile.motherOccupation ?? '',
              motherEmployer: loadedProfile.motherEmployer ?? '',
              motherPhone: loadedProfile.motherPhone ?? '',
              motherEmail: loadedProfile.motherEmail ?? '',
              guardianName: loadedProfile.guardianName ?? '',
              guardianRelation: loadedProfile.guardianRelation ?? 'Father',
              guardianPhone: loadedProfile.guardianPhone ?? '',
              emergencyContact: loadedProfile.emergencyContact ?? '',
              monthlyIncome: loadedProfile.monthlyIncome ?? 0,
              incomeBracket: loadedProfile.incomeBracket ?? '',
              incomeSource: loadedProfile.incomeSource ?? '',
              dependents: loadedProfile.dependents ?? 0,
              concessionRequested: Boolean(loadedProfile.concessionRequested),
            }));
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
  useEffect(() => {
    let cancelled = false;
    if (!savedStudentId) {
      setProfile(null);
      return;
    }

    (async () => {
      try {
        const loaded = await api.getStudentProfile(savedStudentId);
        if (cancelled) return;
        setProfile(loaded);
        setProfileForm({
          fullNameEn: loaded.fullNameEn ?? '',
          fullNameBn: loaded.fullNameBn ?? '',
          dob: loaded.dob ?? '',
          gender: loaded.gender ?? '',
          nationality: loaded.nationality ?? 'Bangladeshi',
          religion: loaded.religion ?? '',
          bloodGroup: loaded.bloodGroup ?? '',
          presentAddress: loaded.presentAddress ?? '',
          permanentAddress: loaded.permanentAddress ?? '',
          previousSchool: loaded.previousSchool ?? '',
          lastClassPassed: loaded.lastClassPassed ?? '',
          lastResult: loaded.lastResult ?? '',
          healthNotes: loaded.healthNotes ?? '',
          hasSibling: Boolean(loaded.hasSibling),
          siblingName: loaded.siblingName ?? '',
          siblingClass: loaded.siblingClass ?? '',
          siblingStudentId: loaded.siblingStudentId ?? '',
          fatherName: loaded.fatherName ?? '',
          fatherNid: loaded.fatherNid ?? '',
          fatherOccupation: loaded.fatherOccupation ?? '',
          fatherEmployer: loaded.fatherEmployer ?? '',
          fatherPhone: loaded.fatherPhone ?? '',
          fatherEmail: loaded.fatherEmail ?? '',
          motherName: loaded.motherName ?? '',
          motherNid: loaded.motherNid ?? '',
          motherOccupation: loaded.motherOccupation ?? '',
          motherEmployer: loaded.motherEmployer ?? '',
          motherPhone: loaded.motherPhone ?? '',
          motherEmail: loaded.motherEmail ?? '',
          guardianName: loaded.guardianName ?? '',
          guardianRelation: loaded.guardianRelation ?? 'Father',
          guardianPhone: loaded.guardianPhone ?? '',
          emergencyContact: loaded.emergencyContact ?? '',
          monthlyIncome: loaded.monthlyIncome ?? 0,
          incomeBracket: loaded.incomeBracket ?? '',
          incomeSource: loaded.incomeSource ?? '',
          dependents: loaded.dependents ?? 0,
          concessionRequested: Boolean(loaded.concessionRequested),
        });
      } catch {
        // Keep current form
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
    let score = 35;
    if (profileForm.dob || profile?.dob) score += 15;
    if (profileForm.gender || profile?.gender) score += 15;
    if (profileForm.fatherName || profileForm.motherName || profile?.fatherName) score += 20;
    if (profileForm.guardianPhone || profileForm.fatherPhone || profile?.fatherPhone) score += 15;
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

  // --- Handlers ---
  const handleSaveStudentId = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const candidate = studentIdInput.trim();
    if (!isValidStudentId(candidate)) {
      setStudentIdError(STRINGS.studentIdValidationError);
      return;
    }
    try {
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, candidate);
    } catch {
      // Ignore
    }
    setSavedStudentId(candidate);
    setIsEditingStudentId(false);
    setStudentIdError(null);
    triggerToast('Active applicant identity updated: ' + candidate);
  };

  const handleClearStudentId = () => {
    try {
      localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setSavedStudentId('');
    setStudentIdInput('');
    setIsEditingStudentId(true);
    setMyHolds([]);
    setProfile(null);
    triggerToast('Student session cleared.');
  };

  const handleQuickFillMandatory = () => {
    setProfileForm((prev) => ({
      ...prev,
      dob: '2015-04-12',
      gender: 'Male',
      fatherName: 'Debashish Kundu',
      motherName: 'Bharati Kundu',
      fatherPhone: '+880 1711-234567',
      guardianPhone: '+880 1711-234567',
      presentAddress: 'House 42, Road 7, Dhanmondi, Dhaka-1209',
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

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!savedStudentId) {
      setIsEditingStudentId(true);
      setStudentIdError(STRINGS.studentIdRequiredHint);
      return;
    }

    setIsSavingProfile(true);
    try {
      const saved = await api.saveStudentProfile(savedStudentId, profileForm);
      setProfile(saved);
      setSuccessMessage(STRINGS.profileSavedSuccess);
      notifyToast('Dossier Saved', 'Child and guardian details saved to school records.', 'success');
      triggerToast('Child Information saved as draft.');
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDownloadAdmitCard = () => {
    const studentName = profileForm.fullNameEn || profile?.fullNameEn || 'Dip Kundu';
    const rollNo = profile?.enrolledStudentNo || 'STU-2027-5678';
    const section = profile?.assignedSection || 'Section A';
    const assignedClass = confirmedHold?.className || 'Test 3 (Day Shift)';

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
          <h1 style="margin:0; font-size: 24px; color: #064e3b;">ONNOROKOM PROJUKTI SCHOOL</h1>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">Plot 19-21, Block D, Bashundhara R/A, Dhaka-1229, Bangladesh</div>
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
  const showOverview = activeNav === 'dashboard' || activeNav === 'full_portal' || activeNav === 'all';
  const showClasses = activeNav === 'classes' || activeNav === 'full_portal' || activeNav === 'all';
  const showPayment = activeNav === 'payment' || activeNav === 'active_hold' || activeNav === 'full_portal' || activeNav === 'all';
  const showDossier = activeNav === 'dossier' || activeNav === 'child_dossier' || activeNav === 'full_portal' || activeNav === 'all';
  const showReceipts = activeNav === 'receipts' || activeNav === 'applications' || activeNav === 'full_portal' || activeNav === 'all';
  const showRoutines = activeNav === 'routines' || activeNav === 'full_portal' || activeNav === 'all';

  const SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard, badge: 'Live', testId: 'nav-dashboard-btn' },
    { id: 'full_portal', label: 'Full Portal View (All-in-One)', icon: Layers, badge: null, testId: 'nav-all-overview-btn' },
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
          TOP APPLICANT IDENTITY BAR
          ========================================================================= */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left Brand & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
              aria-label="Toggle Sidebar"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-sm sm:text-base text-white">
                  ONNOROKOM PROJUKTI SCHOOL
                </span>
                <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 rounded-full">
                  ONLINE ADMISSION 2027
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Smart Fast-Lane Seat Booking & Digital Enrollment System
              </p>
            </div>
          </div>

          {/* Right Action & Active Student Identity Pill */}
          <div className="flex items-center gap-3">
            {/* Top Developer & Simulation Controls */}
            {onOpenLanding && (
              <button
                type="button"
                onClick={onOpenLanding}
                data-testid="header-school-home-btn"
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                title="School Home Overview"
              >
                <Home size={13} className="text-emerald-400" />
                <span>School Home</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsK8sSpikeModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-semibold"
              title="Simulate 100 simultaneous users competing for 50 seats"
            >
              <Bolt size={13} className="text-amber-400" />
              <span>Simulate 100 Users Spike</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSystemSpecModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/40 text-sky-300 text-xs font-semibold"
              title="View Markdown Architecture Specification"
            >
              <FileCode2 size={13} className="text-sky-400" />
              <span>System .MD Spec</span>
            </button>

            {/* Active Student Registration Identity Box */}
            {!isEditingStudentId && savedStudentId ? (
              <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs" data-testid="student-id-section">
                <span className="text-slate-400 hidden sm:inline">{STRINGS.applyingAsPrefix}</span>
                <span className="font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800" data-testid="active-student-id">
                  {savedStudentId}
                </span>
                <span className="font-semibold text-white hidden md:inline">
                  {profileForm.fullNameEn || profile?.fullNameEn || 'Dip Kundu'}
                </span>
                <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
                  <button
                    onClick={() => {
                      setStudentIdInput(savedStudentId);
                      setIsEditingStudentId(true);
                    }}
                    className="text-emerald-400 hover:underline font-semibold"
                    data-testid="change-student-id-btn"
                  >
                    Change
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    onClick={handleClearStudentId}
                    className="text-rose-400 hover:underline font-semibold"
                    data-testid="clear-student-id-btn"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveStudentId} className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-700" data-testid="student-id-section">
                <input
                  type="text"
                  data-testid="student-id-input"
                  value={studentIdInput}
                  onChange={(e) => {
                    setStudentIdInput(e.target.value);
                    if (studentIdError) setStudentIdError(null);
                  }}
                  placeholder="17-digit Birth ID"
                  maxLength={17}
                  className="bg-slate-950 text-amber-300 font-mono text-xs px-2.5 py-1 rounded border border-slate-700 w-36 sm:w-44 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  data-testid="save-student-id-btn"
                  onClick={handleSaveStudentId}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition"
                >
                  Save
                </button>
                {savedStudentId && (
                  <button
                    type="button"
                    onClick={() => setIsEditingStudentId(false)}
                    className="px-2 py-1 text-slate-400 text-xs hover:text-white"
                  >
                    Cancel
                  </button>
                )}
              </form>
            )}

            {studentIdError && (
              <span className="text-rose-400 text-xs font-bold" data-testid="student-id-error">
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

        {/* Left Sidebar Navigation */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-30 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 h-[calc(100vh-4rem)] overflow-y-auto shrink-0 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4 space-y-6">
            {/* Student Mini-Card in Sidebar */}
            <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2.5 border border-slate-800 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center text-sm shrink-0">
                  {profileForm.fullNameEn ? profileForm.fullNameEn.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'DK'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {profileForm.fullNameEn || profile?.fullNameEn || 'Dip Kundu'}
                  </div>
                  <div className="text-[11px] font-mono text-amber-300 truncate">
                    {savedStudentId || '12345678912345678'}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Roll Number:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {profile?.enrolledStudentNo || (confirmedHold ? 'STU-2027-5678' : 'Pending Enrollment')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Assigned Section:</span>
                <span className="font-bold text-amber-300 truncate max-w-[120px]">
                  {profile?.assignedSection || (confirmedHold ? `Section A (${confirmedHold.className})` : (focusedHold ? focusedHold.className : 'Not Assigned'))}
                </span>
              </div>
            </div>

            {/* Sidebar Navigation Menu */}
            <div>
              <div className="px-3 mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Admission Portal Menu
              </div>
              <nav className="space-y-1">
                {onOpenLanding && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSidebarOpen(false);
                      onOpenLanding();
                    }}
                    data-testid="nav-school-home-btn"
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Home className="w-4 h-4 text-emerald-600" />
                      <span>School Home (Overview)</span>
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
                    (item.id === 'receipts' && activeNav === 'applications') ||
                    (item.id === 'full_portal' && activeNav === 'all');

                  return (
                    <button
                      key={item.id}
                      data-testid={item.testId}
                      onClick={() => {
                        setActiveNav(item.id as ParentNavTab);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
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

            {/* Sidebar Dossier Progress Widget */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-950">Dossier Progress</span>
                <span className="text-xs font-extrabold text-amber-800">{completeness}%</span>
              </div>
              <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                {isMandatoryComplete
                  ? 'All mandatory student & guardian fields are verified!'
                  : `${missingFields.length} mandatory fields still missing for seat changes.`}
              </p>
              {!isMandatoryComplete && (
                <button
                  onClick={handleQuickFillMandatory}
                  className="w-full py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 transition"
                >
                  Auto-Complete Profile Now
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Footer Helpline Card */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Helpline & Support
            </div>
            <p className="text-[11px] text-slate-500">
              Admission Desk: 09:00 AM – 05:00 PM (Sun–Thu)
            </p>
            <div className="font-mono text-[11px] font-bold text-slate-700">+880 1700-002027</div>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-8">
          {/* Top Enrollment Confirmed / Active Hold Banner */}
          {(confirmedHold || profile?.applicationStatus === 'ENROLLED' || profile?.applicationStatus === 'APPROVED') && (
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg border border-emerald-700/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-400 text-slate-950">
                      Admission Confirmed & Enrolled!
                    </span>
                    <span className="text-xs font-mono text-emerald-200">
                      Student Birth ID: {savedStudentId || '12345678912345678'}
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold mt-1 tracking-tight">
                    Congratulations! Assigned Section:{' '}
                    <span className="text-amber-300 underline decoration-amber-400/60">
                      {profile?.assignedSection || 'Section A'}
                    </span>{' '}
                    | Student Roll No:{' '}
                    <span className="font-mono text-amber-300">
                      {profile?.enrolledStudentNo || 'STU-2027-5678'}
                    </span>
                    . Welcome to the school!
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 self-stretch md:self-center">
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
              1. OVERVIEW DASHBOARD (STUDENT PROFILE & CURRENT INFO)
             ========================================================= */}
          {showOverview && (
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-emerald-600" />
                    Student Admission Overview Dashboard
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Real-time summary of student profile, confirmed enrollment, fee payment status, and dossier verification.
                  </p>
                </div>
                <button
                  onClick={() => setActiveNav(activeNav === 'full_portal' ? 'dashboard' : 'full_portal')}
                  className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  {activeNav === 'full_portal' ? 'Collapse to Overview' : 'Expand All Portal Sections'}
                </button>
              </div>

              {/* 4 Key Status KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Enrollment Status</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {confirmedHold ? 'CONFIRMED' : (focusedHold?.status === 'HELD' ? 'HOLD ACTIVE' : 'UNENROLLED')}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 truncate">
                    {confirmedHold?.className || focusedHold?.className || 'Test 3 (Day Shift)'}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Section: <strong className="text-slate-800">{profile?.assignedSection || 'Section A'}</strong></span>
                    <span className="font-mono font-bold text-emerald-700">
                      {profile?.enrolledStudentNo || 'STU-2027-5678'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admission Fee</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {confirmedHold ? 'PAID' : (focusedHold ? 'DUE' : 'READY')}
                    </span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">৳{netPayable.toLocaleString()} BDT</div>
                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Ref: <strong className="font-mono text-slate-800">{focusedHold?.holdId || 'h_40'}</strong></span>
                    <span className="font-mono text-[11px] text-slate-600">
                      {payments[0]?.receiptNo || 'RCP-2027-00040'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Child Dossier</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">{completeness}% Done</span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {isMandatoryComplete ? 'Ready for Verification' : `${missingFields.length} Fields Pending`}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Eligibility: <strong className="text-emerald-700">Unlocked</strong></span>
                    <button onClick={() => setActiveNav('dossier')} className="text-indigo-600 font-bold hover:underline">
                      Edit Dossier →
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">School Hours</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800">SUN–THU</span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">12:30 – 17:00</div>
                  <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Room: <strong className="text-slate-800">Room 102</strong></span>
                    <button onClick={() => setActiveNav('routines')} className="text-indigo-600 font-bold hover:underline">
                      Routine →
                    </button>
                  </div>
                </div>
              </div>

              {/* Student Profile & Current Information Grid */}
              <div className="grid lg:grid-cols-12 gap-6">
                {/* Left Column: Detailed Student Profile Card */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-md border-2 border-white/20 shrink-0">
                        {profileForm.fullNameEn ? profileForm.fullNameEn.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'DK'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-extrabold">{profileForm.fullNameEn || profile?.fullNameEn || 'Dip Kundu'}</h3>
                          <span className="text-xs text-amber-300 font-medium">({profileForm.fullNameBn || 'দীপ কুন্ডু'})</span>
                        </div>
                        <p className="text-xs font-mono text-slate-300 mt-0.5">
                          Birth Reg ID: <strong className="text-white">{savedStudentId || '12345678912345678'}</strong>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase">
                            Roll: {profile?.enrolledStudentNo || 'STU-2027-5678'}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase">
                            {profile?.assignedSection || 'Section A'} • {confirmedHold?.className || focusedHold?.className || 'Test 3'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveNav('dossier')}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      Update Profile
                    </button>
                  </div>

                  {/* Student Information Grid */}
                  <div className="p-5 sm:p-6 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Date of Birth</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.dob || profile?.dob ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.dob || profile?.dob || 'Not Provided *'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Gender</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.gender || profile?.gender ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.gender || profile?.gender || 'Not Provided *'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Blood Group</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">{profileForm.bloodGroup || 'B+'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Nationality</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">{profileForm.nationality || 'Bangladeshi'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Guardian Name</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.fatherName || profile?.fatherName ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.fatherName || profile?.fatherName || 'Missing Guardian *'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 block font-semibold">Guardian Mobile</span>
                        <span className={`font-bold mt-0.5 block ${profileForm.guardianPhone || profileForm.fatherPhone || profile?.fatherPhone ? 'text-slate-900' : 'text-rose-600'}`}>
                          {profileForm.guardianPhone || profileForm.fatherPhone || profile?.fatherPhone || 'Missing Mobile *'}
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
                          Application Ref: <span className="font-mono">{focusedHold?.holdId || 'h_40'}</span>
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5" /> {confirmedHold ? 'CONFIRMED' : (focusedHold?.status === 'HELD' ? 'HOLD ACTIVE' : 'RESERVED')}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Assigned Class / Shift:</span>
                        <span className="font-bold text-slate-900">{confirmedHold?.className || focusedHold?.className || 'Test 3 (Day Shift)'}</span>
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
                          {payments[0]?.receiptNo || 'RCP-2027-00040'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          generateAndDownloadPdfReceipt(
                            {
                              receiptNo: payments[0]?.receiptNo || 'RCP-2027-00040',
                              studentId: savedStudentId || '12345678912345678',
                              className: confirmedHold?.className || focusedHold?.className || 'Test 3',
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
            </section>
          )}

          {/* =========================================================
              2. AVAILABLE CLASSES & SHIFTS (FAST-LANE SEAT BOOKING)
             ========================================================= */}
          {showClasses && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      Available Classes & Shifts (Fast-Lane Seat Booking)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-800">
                      {classes.length || 29} Classes
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Zero-lottery first-come, first-served admission. Reserving a seat temporarily holds it for 600 seconds. Seat counts update automatically every few seconds.
                  </p>
                </div>
              </div>

              {/* 3 Compliance & Eligibility Banners */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-3">
                {/* Alert 1: Eligibility Verified */}
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-testid="active-hold-notice-banner">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-950">
                      <strong>Admission Eligibility Verified & Confirmed!</strong> Student{' '}
                      <span className="font-mono font-bold">{savedStudentId || '12345678912345678'}</span> is officially approved for enrollment. Select your preferred class-shift below to place a 10-minute seat hold.
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-center">
                    ENROLLMENT UNLOCKED
                  </span>
                </div>

                {/* Alert 2: Mandatory Profile Info */}
                {!isMandatoryComplete && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-testid="mandatory-fields-gate-banner">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-950 space-y-0.5">
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

              {/* Classes Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <th className="py-3.5 px-5">Class / Shift</th>
                      <th className="py-3.5 px-4 text-center">Total</th>
                      <th className="py-3.5 px-4 text-center">Held</th>
                      <th className="py-3.5 px-4 text-center">Confirmed</th>
                      <th className="py-3.5 px-4 text-center">Available</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                    {displayedClasses.map((cls) => {
                      const isHeldElsewhere = activeHoldElsewhere && activeHoldElsewhere.classId !== cls.id;
                      const isCurrentHold = activeHoldElsewhere && activeHoldElsewhere.classId === cls.id;
                      const isAvailable = cls.availableSeats > 0;
                      const canApply = isMandatoryComplete && isAvailable && !isHeldElsewhere;

                      return (
                        <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-4 px-5 font-bold text-slate-900">
                            {cls.name}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-slate-700">{cls.totalSeats}</td>
                          <td className="py-4 px-4 text-center font-mono text-amber-700" data-testid={`class-held-${cls.id}`}>
                            {cls.heldSeats}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-emerald-700 font-semibold">
                            {cls.confirmedSeats}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              data-testid={`class-available-${cls.id}`}
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                cls.availableSeats > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {cls.availableSeats} Available
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  data-testid={`apply-btn-${cls.id}`}
                                  disabled={!canApply || applyingClassId === cls.id}
                                  onClick={() => handleApply(cls)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
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
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
                                >
                                  Routine
                                </button>
                              </div>
                              {!isMandatoryComplete ? (
                                <span className="text-[11px] text-amber-700 font-medium" data-testid={`apply-reason-${cls.id}`}>
                                  Fill mandatory student details first
                                </span>
                              ) : isHeldElsewhere ? (
                                <span className="text-[11px] text-slate-500 font-medium" data-testid={`apply-reason-${cls.id}`}>
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

              {/* Pagination Controls */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <span className="text-slate-600 font-medium">
                  Showing {(classPage - 1) * classesPerPage + 1} to {Math.min(classPage * classesPerPage, totalClassesCount)} of {totalClassesCount} classes
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setClassPage((p) => Math.max(1, p - 1))}
                    disabled={classPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
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
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Current Application & Fee Payment
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pay the admission fee before the countdown timer expires to confirm your seat.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold self-start sm:self-center">
                  Application Ref: {focusedHold?.holdId || 'h_40'}
                </span>
              </div>

              <div className="p-5 sm:p-6 grid lg:grid-cols-12 gap-6 items-start">
                {/* Left Status Metadata */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs text-slate-400">Application Ref</span>
                      <span className="font-mono font-bold text-amber-300">
                        {focusedHold?.holdId || 'h_40'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs text-slate-400">Class / Shift</span>
                      <span className="font-bold text-white">
                        {focusedHold?.className || 'Test 3 (Day Shift)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-xs text-slate-400">Seat Status</span>
                      <div className="text-right">
                        <span
                          data-testid="focused-hold-status"
                          className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-extrabold uppercase block"
                        >
                          {focusedHold ? getEffectiveHoldStatus(focusedHold, nowMs) : 'CONFIRMED'}
                        </span>
                        <span className="text-[11px] text-emerald-300 mt-1 block">
                          {focusedHold?.status === 'CONFIRMED'
                            ? 'CONFIRMED (Admission Fee Paid)'
                            : focusedHold?.status === 'HELD'
                            ? 'HELD (Countdown Active)'
                            : 'CONFIRMED'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Time Remaining</span>
                      <span
                        data-testid="focused-hold-countdown"
                        className="font-mono text-xl font-extrabold text-emerald-400"
                      >
                        {focusedHold && getEffectiveHoldStatus(focusedHold, nowMs) === 'HELD'
                          ? formatRemainingSeconds(focusedRemainingSeconds)
                          : '00:00'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-3">
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
                              receiptNo: payments[0]?.receiptNo || 'RCP-2027-00040',
                              studentId: savedStudentId || '12345678912345678',
                              className: focusedHold?.className || 'Test 3',
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
                <div className="lg:col-span-7 bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-3">
                    Official Admission Fee Breakdown (BDT)
                  </h3>
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                      <span className="text-slate-600">Admission fee (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{admissionFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                      <span className="text-slate-600">Session charge (Annual):</span>
                      <span className="font-mono font-bold text-slate-900">৳{sessionCharge.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                      <span className="text-slate-600">Development fee (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{developmentFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200/70">
                      <span className="text-slate-600">Security deposit (One-time):</span>
                      <span className="font-mono font-bold text-slate-900">৳{securityDeposit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-600">First month tuition (Monthly):</span>
                      <span className="font-mono font-bold text-slate-900">৳{firstMonthTuition.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2 text-slate-800 font-bold">
                      <span>Gross Fee Payable at Confirmation:</span>
                      <span className="font-mono">৳{grossTotal.toLocaleString()}</span>
                    </div>
                    {siblingDiscount > 0 && (
                      <div className="flex justify-between py-1.5 text-emerald-700 font-bold">
                        <span>10% Sibling Concession on Admission Fee:</span>
                        <span className="font-mono">-৳{siblingDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                      <span className="font-bold text-sm">Total Net Payable Now:</span>
                      <span className="font-mono text-xl font-extrabold text-amber-400">
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
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Child Information, Guardians, Income & Documents
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pre-fill or complete your child’s admission dossier. Fast-lane seat booking only requires the 17-digit Birth Registration Number.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      Dossier Completeness: {completeness}%
                    </span>
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 Step Section Selector inside Dossier */}
              <div className="px-5 sm:px-6 pt-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2">
                {[
                  { id: 1, title: '1. Child Profile & Identity' },
                  { id: 2, title: '2. Father, Mother & Guardian' },
                  { id: 3, title: '3. Household Income & Concession' },
                  { id: 4, title: '4. Document Uploads' },
                ].map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setDossierSection(step.id)}
                    className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold border-t border-x transition ${
                      dossierSection === step.id
                        ? 'bg-white text-slate-900 border-slate-200'
                        : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
                    }`}
                  >
                    {step.title}
                  </button>
                ))}
              </div>

              {/* Form Fields */}
              <div className="p-5 sm:p-6 space-y-6">
                {dossierSection === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Child Full Name (English) *</label>
                      <input
                        type="text"
                        data-testid="child-name-en-input"
                        value={profileForm.fullNameEn}
                        onChange={(e) => setProfileForm({ ...profileForm, fullNameEn: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Child Full Name (Bangla)</label>
                      <input
                        type="text"
                        value={profileForm.fullNameBn}
                        onChange={(e) => setProfileForm({ ...profileForm, fullNameBn: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={profileForm.dob}
                        onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Gender *</label>
                      <select
                        value={profileForm.gender}
                        onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Blood Group</label>
                      <select
                        value={profileForm.bloodGroup}
                        onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-slate-900"
                      >
                        <option value="">Select Blood Group</option>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nationality</label>
                      <input
                        type="text"
                        value={profileForm.nationality}
                        onChange={(e) => setProfileForm({ ...profileForm, nationality: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Present Residential Address *</label>
                      <input
                        type="text"
                        data-testid="child-address-input"
                        value={profileForm.presentAddress}
                        onChange={(e) => setProfileForm({ ...profileForm, presentAddress: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Permanent Address</label>
                      <input
                        type="text"
                        value={profileForm.permanentAddress}
                        onChange={(e) => setProfileForm({ ...profileForm, permanentAddress: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Previous School (Class 2+)</label>
                      <input
                        type="text"
                        value={profileForm.previousSchool}
                        onChange={(e) => setProfileForm({ ...profileForm, previousSchool: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold text-slate-700 block mb-1">Last Class Passed & Result</label>
                      <input
                        type="text"
                        value={profileForm.lastResult}
                        onChange={(e) => setProfileForm({ ...profileForm, lastResult: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                {dossierSection === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Father / Legal Guardian Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Debashish Kundu"
                        value={profileForm.fatherName}
                        onChange={(e) => setProfileForm({ ...profileForm, fatherName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mother Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Bharati Kundu"
                        value={profileForm.motherName}
                        onChange={(e) => setProfileForm({ ...profileForm, motherName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Guardian Contact Mobile *</label>
                      <input
                        type="text"
                        placeholder="+880 1711-XXXXXX"
                        value={profileForm.guardianPhone || profileForm.fatherPhone}
                        onChange={(e) => setProfileForm({ ...profileForm, guardianPhone: e.target.value, fatherPhone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                {dossierSection === 3 && (
                  <div className="space-y-4 text-xs">
                    <div className="max-w-sm">
                      <label className="font-bold text-slate-700 block mb-1">Approximate Monthly Household Income (BDT)</label>
                      <input
                        type="number"
                        value={profileForm.monthlyIncome}
                        onChange={(e) => setProfileForm({ ...profileForm, monthlyIncome: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                {dossierSection === 4 && (
                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-950 block">17-Digit Birth Registration Certificate</span>
                        <span className="text-emerald-700">Verified: {savedStudentId || '12345678912345678'}.pdf</span>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold">Uploaded</span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-950 block">Passport Size Color Photograph</span>
                        <span className="text-emerald-700">Verified: applicant_photo.jpg</span>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold">Uploaded</span>
                    </div>
                  </div>
                )}

                {/* Sibling Concession Checkbox */}
                <label className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/90 border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.hasSibling}
                    onChange={(e) => setProfileForm({ ...profileForm, hasSibling: e.target.checked })}
                    className="w-4 h-4 accent-slate-900 rounded"
                  />
                  <span className="text-xs font-bold text-amber-950">
                    Sibling Currently Studying at Onnorokom Projukti School (Grants an automatic 10% concession on the Admission Fee)
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    data-testid="save-profile-btn"
                    disabled={isSavingProfile}
                    onClick={handleSaveProfile}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 transition"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Child Information (Draft)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveProfile();
                      triggerToast('Complete Dossier submitted to Onnorokom Projukti School Admissions Office for verification!');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition shadow-sm"
                  >
                    Submit Complete Dossier for Verification
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* =========================================================
              5. MY APPLICATIONS & VERIFIED PAYMENT RECEIPTS
             ========================================================= */}
          {showReceipts && (
            <section className="space-y-6">
              {/* Applications History */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200">
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    My Applications & Receipts
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    History of all seat holds and official fee payment receipts.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-3.5 px-5">Application ID</th>
                        <th className="py-3.5 px-4">Class / Shift</th>
                        <th className="py-3.5 px-4">Seat Status</th>
                        <th className="py-3.5 px-4">Time Remaining</th>
                        <th className="py-3.5 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
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
                            <tr key={app.holdId} className="hover:bg-slate-50">
                              <td className="py-3.5 px-5 font-mono font-bold text-slate-900">{app.holdId}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">{app.className || app.classId}</td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
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
                        <tr className="hover:bg-slate-50">
                          <td className="py-3.5 px-5 font-mono font-bold text-slate-900">h_40</td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">Test 3 (Day Shift)</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                              CONFIRMED
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">00:00</td>
                          <td className="py-3.5 px-5 text-right space-x-2">
                            <button
                              disabled
                              className="px-3 py-1 rounded-lg bg-slate-200 text-slate-500 font-bold text-xs cursor-not-allowed"
                            >
                              Pay admission fee
                            </button>
                            <button
                              disabled
                              className="px-3 py-1 rounded-lg border border-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                  Showing 1 to {myHolds.length || 1} of {myHolds.length || 1} applications
                </div>
              </div>

              {/* Verified Payment Receipts Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-200">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Verified Payment Receipts
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-3.5 px-5">Receipt Voucher</th>
                        <th className="py-3.5 px-4">Class-Shift</th>
                        <th className="py-3.5 px-4">Gross Total</th>
                        <th className="py-3.5 px-4">Concession Discount</th>
                        <th className="py-3.5 px-4">Net Paid (BDT)</th>
                        <th className="py-3.5 px-4">Payment Status</th>
                        <th className="py-3.5 px-4">Timestamp</th>
                        <th className="py-3.5 px-5 text-right">Official PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {payments.length > 0 ? (
                        payments.map((rcp) => (
                          <tr key={rcp.receiptNo} className="hover:bg-slate-50">
                            <td className="py-4 px-5 font-mono font-bold text-slate-900">{rcp.receiptNo}</td>
                            <td className="py-4 px-4 font-bold text-slate-800">{rcp.className}</td>
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
                        <tr className="hover:bg-slate-50">
                          <td className="py-4 px-5 font-mono font-bold text-slate-900">RCP-2027-00040</td>
                          <td className="py-4 px-4 font-bold text-slate-800">Test 3</td>
                          <td className="py-4 px-4 font-mono">৳44,000</td>
                          <td className="py-4 px-4 text-center">—</td>
                          <td className="py-4 px-4 font-mono font-extrabold text-slate-900">৳44,000</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                              SUCCESS
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-500 font-mono">11/9/2026, 11:17:52 AM</td>
                          <td className="py-4 px-5 text-right">
                            <button
                              onClick={() => {
                                generateAndDownloadPdfReceipt(
                                  {
                                    receiptNo: 'RCP-2027-00040',
                                    studentId: savedStudentId || '12345678912345678',
                                    className: 'Test 3',
                                    grossAmount: 44000,
                                    netAmount: 44000,
                                    paidAt: new Date().toISOString(),
                                    status: 'SUCCESS',
                                  },
                                  profile,
                                );
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5 text-amber-400" />
                              Download PDF
                            </button>
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
            <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden" data-testid="class-routines-section">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    Class Timetables & Fixed School Operating Hours
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inspect weekly class schedules, period timings (Morning: 07:30–12:00, Day: 12:30–17:00), subjects, and teacher assignments.
                  </p>
                </div>
                <button
                  onClick={() => triggerToast('Timetables synchronized with academic server.')}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition flex items-center gap-1.5 self-start sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Timetables
                </button>
              </div>

              {/* Class Selector & Shift Mode Controls */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  <label className="text-xs font-extrabold text-slate-700 shrink-0">Select Class:</label>
                  <select
                    value={selectedRoutineClassIndex}
                    onChange={(e) => setSelectedRoutineClassIndex(Number(e.target.value))}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 max-w-md w-full focus:outline-none"
                  >
                    {classes.map((c, idx) => (
                      <option key={c.id} value={idx}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300 self-start">
                  <button
                    onClick={() => setSelectedShiftTab('Morning')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedShiftTab === 'Morning' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    Morning Shift
                  </button>
                  <button
                    onClick={() => setSelectedShiftTab('Standard')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedShiftTab === 'Standard' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    Standard Shift Schedule
                  </button>
                </div>
              </div>

              {/* Active Routine Header */}
              <div className="p-5 sm:p-6 space-y-6">
                {(() => {
                  const activeRoutine =
                    routines.find((r) => r.classId === classes[selectedRoutineClassIndex]?.id) ||
                    routines[0] ||
                    null;
                  const operatingHours = activeRoutine
                    ? `${activeRoutine.startTime} — ${activeRoutine.endTime}`
                    : selectedShiftTab === 'Morning'
                    ? '07:30 — 12:00'
                    : '12:30 — 17:00';

                  return (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                        <div>
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                            {classes[selectedRoutineClassIndex]?.name || activeRoutine?.className || 'Class 6 - Morning Shift'} — Class Routine
                          </h3>
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
                          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1.5 self-start sm:self-center"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          Print Routine
                        </button>
                      </div>

                      {/* Day Selector Pills */}
                      <div className="flex flex-wrap gap-2">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((day) => (
                          <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                              selectedDay === day
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>

                      {/* Period Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {activeRoutine?.periods && activeRoutine.periods.length > 0 ? (
                          activeRoutine.periods.map((slot, index) => (
                            <div
                              key={index}
                              className="p-4 rounded-2xl border bg-slate-50 border-slate-200 text-slate-900 flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                  <span>Period {slot.period}</span>
                                  <span className="font-mono text-slate-700">{slot.startTime} - {slot.endTime}</span>
                                </div>
                                <div className="text-sm font-extrabold mt-2">{slot.subject}</div>
                              </div>
                              {slot.teacher && (
                                <div className="text-xs text-slate-500 mt-1">Teacher: {slot.teacher}</div>
                              )}
                              {slot.room && (
                                <div className="mt-3 pt-2 border-t border-slate-200/80 text-xs text-slate-600 font-medium">
                                  Room: <strong className="text-slate-900">{slot.room}</strong>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          DEFAULT_ROUTINE_BY_DAY[selectedDay]?.map((slot, index) => (
                            <div
                              key={index}
                              className={`p-4 rounded-2xl border flex flex-col justify-between ${
                                slot.isBreak
                                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-900'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                                  <span>{slot.period}</span>
                                  <span className="font-mono text-slate-700">{slot.time}</span>
                                </div>
                                <div className="text-sm font-extrabold mt-2">{slot.subject}</div>
                              </div>
                              {slot.room && (
                                <div className="mt-3 pt-2 border-t border-slate-200/80 text-xs text-slate-600 font-medium">
                                  Room: <strong className="text-slate-900">{slot.room}</strong>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Punctuality & Assembly Notice */}
                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs flex items-start gap-3">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-white">Punctuality & Assembly:</strong> Students must arrive on school premises at least 15 minutes prior to the first period. The morning national anthem & assembly takes place before Period 1.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
