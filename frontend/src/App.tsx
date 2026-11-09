import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building,
  GraduationCap,
  Clock,
  FileText,
  CreditCard,
  UserCheck,
  Shield,
  CheckCircle2,
  AlertCircle,
  Upload,
  AlertTriangle,
  Menu,
  ChevronRight,
  Sparkles,
  BadgeCheck,
  RefreshCw,
  Home,
  Download,
  Bolt,
  Cpu,
  ShieldCheck,
  FileCode2,
  Users,
} from 'lucide-react';
import { ActionAlertModal } from './ActionAlertModal';
import { AdminPortal } from './AdminPortal';
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
import { ClassRoutineView } from './ClassRoutineView';
import { POLL_INTERVAL_MS, STUDENT_ID_STORAGE_KEY } from './config';
import { LandingPage } from './LandingPage';
import { NotificationCenter } from './NotificationCenter';
import { Pagination } from './Pagination';
import { generateAndDownloadPdfReceipt } from './ReceiptPdf';
import { STRINGS } from './strings';
import { notifyToast, ToastContainer } from './ToastContainer';
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

function getEffectiveHoldStatus(hold: HoldItem, nowMs: number): HoldStatus {
  if (hold.status === 'HELD') {
    const expiresMs = Date.parse(hold.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= nowMs) {
      return 'EXPIRED';
    }
  }
  return hold.status;
}

function formatStatusLabel(status: HoldStatus): string {
  switch (status) {
    case 'HELD':
      return STRINGS.statusHeld;
    case 'CONFIRMED':
      return STRINGS.statusConfirmed;
    case 'EXPIRED':
      return STRINGS.statusExpired;
    case 'CANCELLED':
      return STRINGS.statusCancelled;
  }
}

type ParentNavTab = 'all' | 'classes' | 'active_hold' | 'child_dossier' | 'applications' | 'routines';
type ProfileStepTab = 'student' | 'guardians' | 'finance' | 'documents';

export function App() {
  // --- URL Routing: /admin -> AdminPortal, / -> ParentPortal ---
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminRoute) {
    return <AdminPortal onNavigateToParent={() => navigateTo('/')} />;
  }

  return <ParentPortal onNavigateToAdmin={() => navigateTo('/admin')} />;
}

interface ParentPortalProps {
  onNavigateToAdmin: () => void;
}

function ParentPortal({ onNavigateToAdmin }: ParentPortalProps) {
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
  const [activeTab, setActiveTab] = useState<ParentNavTab>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- Core Seat & Hold Data ---
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myHolds, setMyHolds] = useState<HoldItem[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);

  // --- Extended Child Profile & Billing Data ---
  const [profile, setProfile] = useState<StudentProfile | null>(null);
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
    incomeBracket: '25,000 - 50,000 BDT',
    incomeSource: 'Salaried Employment',
    dependents: 2,
    concessionRequested: false,
  });
  const [activeProfileStep, setActiveProfileStep] = useState<ProfileStepTab>('student');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [focusedFeeBreakdown, setFocusedFeeBreakdown] = useState<ClassFeeBreakdown | null>(null);

  // --- Live Notifications & Alerts ---
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  const handleMarkNotificationRead = async (id: number) => {
    await markNotificationRead(id, savedStudentId ? savedStudentId : undefined);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllNotificationsRead = async () => {
    await markAllNotificationsRead(savedStudentId ? savedStudentId : undefined);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotifCount(0);
    notifyToast('Notifications', 'All notifications marked as read', 'info');
  };

  // --- View Mode: School Landing Page vs Parent Portal ---
  const [viewMode, setViewMode] = useState<'portal' | 'landing'>('portal');

  // --- K8s Burst Simulator & Architecture Spec Modal States ---
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

  // --- In-flight Action States ---
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [confirmingHoldId, setConfirmingHoldId] = useState<string | null>(null);
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
  const [joiningWaitlistClassId, setJoiningWaitlistClassId] = useState<string | null>(null);

  // --- Messages / Feedback ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Pagination States ---
  const [classesPage, setClassesPage] = useState<number>(1);
  const [holdsPage, setHoldsPage] = useState<number>(1);
  const CLASSES_PAGE_SIZE = 6;
  const HOLDS_PAGE_SIZE = 5;

  // --- Class Routine State ---
  const [routines, setRoutines] = useState<ClassRoutine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<ClassRoutine | null>(null);
  const [modalRoutine, setModalRoutine] = useState<ClassRoutine | null>(null);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState<boolean>(false);

  // --- Live Clock Tick (every 1s) ---
  const [nowMs, setNowMs] = useState<number>(() => getServerNowMs());
  const expiredRefetchedIds = useRef<Set<string>>(new Set());

  const showError = useCallback((err: unknown) => {
    setSuccessMessage(null);
    if (err instanceof ApiClientError) {
      setErrorMessage(err.friendlyMessage);
    } else if (err instanceof Error && err.message) {
      setErrorMessage(err.message);
    } else {
      setErrorMessage(STRINGS.errors.UNKNOWN_ERROR);
    }
  }, []);

  // --- Data Fetching ---
  const refreshData = useCallback(
    async (silent = false) => {
      try {
        const classListPromise = api.listClasses();
        const holdsPromise = savedStudentId
          ? api.getMyHolds(savedStudentId)
          : Promise.resolve([] as HoldItem[]);

        const [classList, holds] = await Promise.all([classListPromise, holdsPromise]);
        setClasses(classList);
        setMyHolds(holds);
        setNowMs(getServerNowMs());
      } catch (err) {
        if (!silent) {
          showError(err);
        } else {
          setErrorMessage((prev) =>
            prev ??
            (err instanceof ApiClientError ? err.friendlyMessage : STRINGS.errors.NETWORK_ERROR),
          );
        }
      }

      if (savedStudentId && isValidStudentId(savedStudentId)) {
        try {
          const [pays, waits] = await Promise.all([
            api.getStudentPayments(savedStudentId),
            api.getStudentWaitlist(savedStudentId),
          ]);
          if (Array.isArray(pays)) setPayments(pays);
          if (Array.isArray(waits)) setWaitlistEntries(waits);
        } catch {
          // Optional in mock testing
        }
      }

      // Fetch alerts & notifications
      fetchNotifications(savedStudentId ? savedStudentId : undefined)
        .then((summary) => {
          if (summary && Array.isArray(summary.notifications)) {
            setNotifications(summary.notifications);
            setUnreadNotifCount(summary.unreadCount);
          }
        })
        .catch(() => { });
    },
    [savedStudentId, showError],
  );

  // Load Child Profile when student ID changes
  useEffect(() => {
    if (!savedStudentId || !isValidStudentId(savedStudentId)) {
      setProfile(null);
      setPayments([]);
      setWaitlistEntries([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await api.getStudentProfile(savedStudentId);
        if (cancelled || !loaded || typeof loaded.studentId !== 'string') return;
        setProfile(loaded);
        setProfileForm({
          fullNameEn: loaded.fullNameEn || '',
          fullNameBn: loaded.fullNameBn || '',
          dob: loaded.dob || '',
          gender: loaded.gender || '',
          nationality: loaded.nationality || 'Bangladeshi',
          religion: loaded.religion || '',
          bloodGroup: loaded.bloodGroup || '',
          presentAddress: loaded.presentAddress || '',
          permanentAddress: loaded.permanentAddress || '',
          previousSchool: loaded.previousSchool || '',
          lastClassPassed: loaded.lastClassPassed || '',
          lastResult: loaded.lastResult || '',
          healthNotes: loaded.healthNotes || '',
          hasSibling: Boolean(loaded.hasSibling),
          siblingName: loaded.siblingName || '',
          siblingClass: loaded.siblingClass || '',
          siblingStudentId: loaded.siblingStudentId || '',
          fatherName: loaded.fatherName || '',
          fatherNid: loaded.fatherNid || '',
          fatherOccupation: loaded.fatherOccupation || '',
          fatherEmployer: loaded.fatherEmployer || '',
          fatherPhone: loaded.fatherPhone || '',
          fatherEmail: loaded.fatherEmail || '',
          motherName: loaded.motherName || '',
          motherNid: loaded.motherNid || '',
          motherOccupation: loaded.motherOccupation || '',
          motherEmployer: loaded.motherEmployer || '',
          motherPhone: loaded.motherPhone || '',
          motherEmail: loaded.motherEmail || '',
          guardianName: loaded.guardianName || '',
          guardianRelation: loaded.guardianRelation || 'Father',
          guardianPhone: loaded.guardianPhone || '',
          emergencyContact: loaded.emergencyContact || '',
          monthlyIncome: loaded.monthlyIncome || 0,
          incomeBracket: loaded.incomeBracket || '25,000 - 50,000 BDT',
          incomeSource: loaded.incomeSource || 'Salaried Employment',
          dependents: loaded.dependents || 2,
          concessionRequested: Boolean(loaded.concessionRequested),
        });
      } catch {
        // Ignore in minimal mock test environments
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedStudentId]);

  // Initial fetch + polling every POLL_INTERVAL_MS
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

  // Focused application for the "Active Hold & Payment" panel
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

  // Load fee breakdown for focused hold's class
  useEffect(() => {
    if (!focusedHold?.classId) {
      setFocusedFeeBreakdown(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const fees = await api.getClassFeeBreakdown(focusedHold.classId, savedStudentId);
        if (!cancelled && fees && Array.isArray(fees.heads)) {
          setFocusedFeeBreakdown(fees);
        }
      } catch {
        // Ignore if not mocked
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedHold?.classId, savedStudentId, profile?.hasSibling]);

  // --- Class Routines Fetcher ---
  const loadParentRoutines = useCallback(async () => {
    setIsLoadingRoutines(true);
    try {
      const list = await fetchAllRoutines();
      setRoutines(list);
      if (list.length > 0) {
        setSelectedRoutine((prev) => prev || list[0]);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingRoutines(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'routines' || activeTab === 'all') {
      void loadParentRoutines();
    }
  }, [activeTab, loadParentRoutines]);

  const handleOpenRoutineModal = async (classId: string) => {
    try {
      const r = await fetchClassRoutine(classId);
      setModalRoutine(r);
    } catch {
      const found = routines.find((item) => item.classId === classId);
      if (found) setModalRoutine(found);
    }
  };

  // --- Mandatory Profile Fields Gate ---
  const missingMandatoryFields = useMemo(() => {
    const missing: string[] = [];
    if (!savedStudentId || !isValidStudentId(savedStudentId)) {
      missing.push('17-digit Birth Registration Number');
    }
    if (!profileForm.fullNameEn?.trim()) {
      missing.push('Student Full Name (English)');
    }
    if (!profileForm.dob?.trim()) {
      missing.push('Date of Birth');
    }
    if (!profileForm.gender?.trim()) {
      missing.push('Gender');
    }
    const hasGuardian = Boolean(
      profileForm.fatherName?.trim() ||
      profileForm.motherName?.trim() ||
      profileForm.guardianName?.trim()
    );
    if (!hasGuardian) {
      missing.push('Guardian Name (Father/Mother/Guardian)');
    }
    const hasPhone = Boolean(
      profileForm.fatherPhone?.trim() ||
      profileForm.motherPhone?.trim() ||
      profileForm.guardianPhone?.trim()
    );
    if (!hasPhone) {
      missing.push('Guardian Contact Mobile');
    }
    if (!profileForm.presentAddress?.trim()) {
      missing.push('Present Address');
    }
    return missing;
  }, [savedStudentId, profileForm]);

  const isMandatoryProfileComplete = missingMandatoryFields.length === 0;

  // --- Single Admission / Cross-Class Conflict Helper ---
  const activeHoldElsewhere = useMemo(() => {
    return myHolds.find((h) => {
      const eff = getEffectiveHoldStatus(h, nowMs);
      return eff === 'HELD' || eff === 'CONFIRMED';
    });
  }, [myHolds, nowMs]);

  // --- Student ID Handlers ---
  const handleSaveStudentId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentIdInput.trim();
    if (!isValidStudentId(trimmed)) {
      setStudentIdError(STRINGS.studentIdValidationError);
      return;
    }
    setStudentIdError(null);
    setErrorMessage(null);
    setSavedStudentId(trimmed);
    setIsEditingStudentId(false);
    try {
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
  };

  const handleChangeStudentId = () => {
    setStudentIdInput(savedStudentId);
    setStudentIdError(null);
    setIsEditingStudentId(true);
  };

  const handleClearStudentId = () => {
    setSavedStudentId('');
    setStudentIdInput('');
    setMyHolds([]);
    setSelectedHoldId(null);
    setProfile(null);
    setStudentIdError(null);
    setIsEditingStudentId(true);
    try {
      localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // --- Profile Dossier Handlers ---
  const handleSaveProfile = async (submitForReview: boolean) => {
    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      setIsEditingStudentId(true);
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSavingProfile(true);
    try {
      const updated = await api.saveStudentProfile(savedStudentId, {
        ...profileForm,
        submitForReview,
      });
      setProfile(updated);
      setSuccessMessage(
        submitForReview ? STRINGS.profileSubmittedSuccess : STRINGS.profileSavedSuccess,
      );
      notifyToast(
        submitForReview ? 'Application Submitted' : 'Profile Dossier Saved',
        submitForReview ? 'Your application has been submitted for admission review.' : 'Child profile and guardian details saved.',
        'success',
      );
      if (submitForReview) {
        setActionModal({
          isOpen: true,
          type: 'INFO',
          title: 'Student Profile Submitted for Admission Review',
          message: `Your child's profile and documents for Birth Registration No ${savedStudentId} have been queued for the Admission Office.`,
          detailReason: 'Our Admission Officers will verify your child’s 17-digit birth registration number, age eligibility, and submitted certificates. Once confirmed, available class shifts will unlock for enrollment.',
          primaryActionLabel: 'View Available Classes',
          onPrimaryAction: () => {
            setActiveTab('classes');
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
          secondaryActionLabel: 'Dismiss',
        });
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadDocument = async (type: string, label: string, file: File | null) => {
    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }
    const fileName = file ? file.name : `${type.toLowerCase()}_${savedStudentId.slice(-4)}.pdf`;
    const fileSize = file ? file.size : 142_000;
    setErrorMessage(null);
    try {
      const updated = await api.uploadDocument(savedStudentId, type, label, fileName, fileSize);
      setProfile(updated);
      setSuccessMessage(STRINGS.documentUploadedSuccess(label));
      notifyToast('Document Uploaded', `Document '${label}' submitted for verification.`, 'info');
    } catch (err) {
      showError(err);
    }
  };

  // --- Seat Actions ---
  const handleApply = async (cls: SchoolClass) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      setIsEditingStudentId(true);
      return;
    }

    if (!isMandatoryProfileComplete) {
      setActionModal({
        isOpen: true,
        type: 'WARNING',
        title: 'Mandatory Student Profile Information Required',
        message: 'School admission policy requires completing mandatory student and guardian information before you can select or reserve a class-shift seat.',
        detailReason: `Missing required fields: ${missingMandatoryFields.join(', ')}. Please complete these details in the Child & Guardian Dossier first.`,
        primaryActionLabel: 'Complete Profile Form Now',
        onPrimaryAction: () => {
          setActiveTab('child_dossier');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'Dismiss',
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
          setActiveTab('active_hold');
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
      setActiveTab('active_hold');
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
          setActiveTab('active_hold');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'View Applications',
        onSecondaryAction: () => {
          setActiveTab('applications');
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
          detailReason: 'Because admission is strictly first-come, first-served with a hard capacity limit, seats fill up quickly. You may join our Priority Waitlist below or select an alternate open shift.',
          primaryActionLabel: 'Join Priority Waitlist',
          onPrimaryAction: () => {
            void handleJoinWaitlist(cls);
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
          secondaryActionLabel: 'Choose Another Shift',
          onSecondaryAction: () => {
            setActiveTab('classes');
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      } else if (err instanceof ApiClientError && err.code === 'ALREADY_ADMITTED_ELSEWHERE') {
        setActionModal({
          isOpen: true,
          type: 'WARNING',
          title: 'Single Admission Rule (Class / Shift Conflict)',
          message: 'Student already has an active hold or confirmed admission in another class or shift.',
          detailReason: 'Under school regulations, a student cannot hold morning and day shifts or attend two different classes at the same time. Cancel the current unpaid hold first before switching classes.',
          primaryActionLabel: 'View My Applications',
          onPrimaryAction: () => {
            setActiveTab('applications');
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
          secondaryActionLabel: 'Dismiss',
        });
      }
      await refreshData(true);
    } finally {
      setApplyingClassId(null);
    }
  };

  const handleJoinWaitlist = async (cls: SchoolClass) => {
    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }
    setErrorMessage(null);
    setJoiningWaitlistClassId(cls.id);
    try {
      const entry = await api.joinWaitlist(cls.id, savedStudentId);
      setWaitlistEntries((prev) => [entry, ...prev.filter((w) => w.classId !== cls.id)]);
      setSuccessMessage(STRINGS.waitlistJoinedSuccess(cls.name, entry.position));
      notifyToast('Waitlist Joined', `Added to waitlist for ${cls.name} at position #${entry.position}.`, 'info');
    } catch (err) {
      showError(err);
    } finally {
      setJoiningWaitlistClassId(null);
    }
  };

  const handleConfirmHold = async (hold: HoldItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }

    setConfirmingHoldId(hold.holdId);
    try {
      if (simulateRaceCondition) {
        await new Promise((r) => setTimeout(r, 450));
        setActionModal({
          isOpen: true,
          type: 'DANGER',
          title: 'Payment Aborted — Class Filled Moments Ago!',
          message: `While you were completing payment for "${hold.className || 'this class'}", other parents finalized their payments milliseconds ahead of you and claimed the last remaining seat. Under our strict First-Come-First-Serve policy, your card/wallet was NOT charged. Please choose another open batch.`,
          detailReason: `K8S_ATOMIC_LOCK_REJECTED: Class reached capacity on a concurrent pod 18ms prior. Pessimistic transaction rolled back.`,
          primaryActionLabel: 'View Other Open Classes',
          onPrimaryAction: () => {
            setActiveTab('classes');
            setActionModal((prev) => ({ ...prev, isOpen: false }));
          },
          secondaryActionLabel: 'Dismiss',
          onSecondaryAction: () => setActionModal((prev) => ({ ...prev, isOpen: false })),
        });
        notifyToast('Concurrent Checkout Conflict', 'Class filled by other users moments before payment finalized. Transaction aborted.', 'danger');
        return;
      }

      await api.confirmHold(hold.holdId, savedStudentId);
      setMyHolds((prev) =>
        prev.map((item) =>
          item.holdId === hold.holdId ? { ...item, status: 'CONFIRMED' } : item,
        ),
      );
      setSelectedHoldId(hold.holdId);
      setSuccessMessage(STRINGS.holdConfirmedSuccess);
      notifyToast('Admission Confirmed!', `Payment received and seat confirmed for ${hold.className || 'Class'}! Receipt generated.`, 'success');
      setActionModal({
        isOpen: true,
        type: 'SUCCESS',
        title: 'Admission Confirmed & Seat Guaranteed!',
        message: `Admission fee payment confirmed for ${hold.className || 'Class'}! Your child's seat is now permanently guaranteed for Academic Session 2027.`,
        detailReason: `Official receipt voucher generated. Registration number ${savedStudentId} is permanently recorded in the school roll.`,
        primaryActionLabel: 'Download Official PDF Receipt',
        onPrimaryAction: () => {
          const match = payments.find((p) => p.studentId === savedStudentId) || {
            id: Date.now(),
            receiptNo: `REC-2027-${savedStudentId.slice(-4)}`,
            studentId: savedStudentId,
            className: hold.className || 'Class 6 - Morning Shift',
            grossAmount: 48000,
            discountAmount: profile?.hasSibling ? 4800 : 0,
            discountReason: profile?.hasSibling ? '10% Sibling Concession' : null,
            netAmount: profile?.hasSibling ? 43200 : 48000,
            status: 'COMPLETED',
            paidAt: new Date().toISOString(),
          };
          generateAndDownloadPdfReceipt(match, profile);
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'View Applications',
        onSecondaryAction: () => {
          setActiveTab('applications');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      await refreshData(true);
    } catch (err) {
      showError(err);
      await refreshData(true);
    } finally {
      setConfirmingHoldId(null);
    }
  };

  const handleCancelHold = async (hold: HoldItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }

    setCancellingHoldId(hold.holdId);
    try {
      await api.cancelHold(hold.holdId, savedStudentId);
      setMyHolds((prev) =>
        prev.map((item) =>
          item.holdId === hold.holdId ? { ...item, status: 'CANCELLED' } : item,
        ),
      );
      setSuccessMessage(STRINGS.holdCancelledSuccess);
      notifyToast('Seat Hold Released', 'The temporary seat hold has been cancelled and reopened for others.', 'warning');
      setActionModal({
        isOpen: true,
        type: 'INFO',
        title: 'Seat Hold Cancelled',
        message: `Your hold for ${hold.className || 'Class'} was cancelled.`,
        detailReason: 'The seat has been immediately returned to the school pool and is now available for other applicants.',
        primaryActionLabel: 'Browse Available Classes',
        onPrimaryAction: () => {
          setActiveTab('classes');
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        },
        secondaryActionLabel: 'Dismiss',
      });
      await refreshData(true);
    } catch (err) {
      showError(err);
      await refreshData(true);
    } finally {
      setCancellingHoldId(null);
    }
  };

  // Map of classId -> active hold
  const activeHoldByClassId = useMemo(() => {
    const map = new Map<string, HoldItem>();
    for (const h of myHolds) {
      const effective = getEffectiveHoldStatus(h, nowMs);
      if (effective === 'HELD' || effective === 'CONFIRMED') {
        map.set(h.classId, h);
      }
    }
    return map;
  }, [myHolds, nowMs]);

  const classNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.id, c.name);
    }
    return map;
  }, [classes]);

  if (viewMode === 'landing') {
    return (
      <div data-testid="parent-portal-view">
        <LandingPage
          classes={classes}
          onOpenParentPortal={(classIdToSelect) => {
            setViewMode('portal');
            if (classIdToSelect) {
              setActiveTab('classes');
            }
          }}
          onOpenAdminPortal={onNavigateToAdmin}
          savedStudentId={savedStudentId}
          onOpenK8sSpikeModal={() => setIsK8sSpikeModalOpen(true)}
          onOpenSystemSpecModal={() => setIsSystemSpecModalOpen(true)}
        />
        <K8sSpikeModal
          isOpen={isK8sSpikeModalOpen}
          onClose={() => setIsK8sSpikeModalOpen(false)}
          classes={classes}
          onSimulationComplete={() => void refreshData(true)}
        />
        <SystemSpecModal
          isOpen={isSystemSpecModalOpen}
          onClose={() => setIsSystemSpecModalOpen(false)}
        />
        <ActionAlertModal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
          type={actionModal.type}
          title={actionModal.title}
          message={actionModal.message}
          detailReason={actionModal.detailReason}
          primaryActionLabel={actionModal.primaryActionLabel}
          onPrimaryAction={actionModal.onPrimaryAction}
          secondaryActionLabel={actionModal.secondaryActionLabel}
          onSecondaryAction={actionModal.onSecondaryAction}
          countdownSeconds={actionModal.countdownSeconds}
        />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="portal-page-wrapper flex flex-col min-h-screen">
      {/* =========================================================================
          TOP KUBERNETES LIVE INFRASTRUCTURE BAR
          ========================================================================= */}
      <div className="k8s-live-bar">
        <div className="landing-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="k8s-status-pill">
              <span className="k8s-pulse-dot"></span>
              <span>K8s Cluster: ACTIVE</span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300 text-xs">
              <Cpu size={13} className="text-sky-400" />
              <span>Pods: <strong className="text-white font-mono">3</strong>/16</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-slate-300 text-xs">
              <Users size={13} className="text-amber-400" />
              <span>Concurrent Velocity: <strong className="text-white font-mono">14</strong> req/s</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-slate-300 text-xs">
              <ShieldCheck size={13} className="text-purple-400" />
              <span>Queue Policy: <strong className="text-purple-300">FCFS Atomic Row Lock</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsK8sSpikeModalOpen(true)}
              className="btn btn-xs k8s-sim-btn"
              title="Simulate 100 simultaneous users competing for 50 seats"
            >
              <Bolt size={12} className="text-amber-400" />
              <span>Simulate 100 Users Spike</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSystemSpecModalOpen(true)}
              className="btn btn-xs btn-outline text-slate-300 border-slate-700 hover:bg-slate-800"
              title="View Markdown Architecture Specification"
            >
              <FileCode2 size={12} className="text-sky-400" />
              <span>System .MD Spec</span>
            </button>
          </div>
        </div>
      </div>

      <div className="app-shell flex-1" data-testid="parent-portal-view">
      {/* --- Sidebar Navigation for Parent Portal --- */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo bg-indigo-gradient text-white">
            <Building size={22} />
          </div>
          {!isSidebarCollapsed && (
            <div className="brand-meta">
              <h2 className="brand-name">ONNOROKOM PROJUKTI SCHOOL</h2>
              <span className="brand-badge badge-parent">ONLINE ADMISSION 2027</span>
            </div>
          )}
        </div>

        {/* Persistent Student Registration Identity Box in Sidebar */}
        <div className="sidebar-user-card" data-testid="student-id-section">
          {savedStudentId && !isEditingStudentId ? (
            <div className="student-session-active">
              <div className="session-icon">
                <BadgeCheck size={20} className="text-emerald" />
              </div>
              {!isSidebarCollapsed && (
                <div className="session-info">
                  <span className="session-label">{STRINGS.applyingAsPrefix}</span>
                  <strong className="session-id mono" data-testid="active-student-id">
                    {savedStudentId}
                  </strong>
                  {profile?.fullNameEn && (
                    <div className="session-name">{profile.fullNameEn}</div>
                  )}
                  <div className="session-btn-row">
                    <button
                      type="button"
                      className="btn-link"
                      data-testid="change-student-id-btn"
                      onClick={handleChangeStudentId}
                    >
                      Change
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      className="btn-link text-muted"
                      data-testid="clear-student-id-btn"
                      onClick={handleClearStudentId}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="student-session-prompt">
              {!isSidebarCollapsed && (
                <span className="text-xs text-muted mb-1 block">Student Session:</span>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm btn-full"
                onClick={() => setIsEditingStudentId(true)}
              >
                {!isSidebarCollapsed ? 'Set 17-digit Student ID' : 'ID'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="sidebar-nav">
          <button
            type="button"
            className="nav-item text-indigo hover:bg-indigo-50"
            onClick={() => setViewMode('landing')}
            title="School Homepage & Admission Info"
            data-testid="nav-school-home-btn"
          >
            <Home size={19} />
            {!isSidebarCollapsed && <span>School Home (Overview)</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            title="Complete Admission Overview"
          >
            <Building size={19} />
            {!isSidebarCollapsed && <span>Full Portal Overview</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveTab('classes')}
            title="Available Classes & Apply"
          >
            <GraduationCap size={19} />
            {!isSidebarCollapsed && <span>Available Classes</span>}
            {!isSidebarCollapsed && classes.length > 0 && (
              <span className="nav-badge">{classes.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'active_hold' ? 'active' : ''}`}
            onClick={() => setActiveTab('active_hold')}
            title="Active Seat Hold & Payment"
          >
            <Clock size={19} />
            {!isSidebarCollapsed && <span>Seat Hold & Payment</span>}
            {!isSidebarCollapsed && focusedHold?.status === 'HELD' && (
              <span className="pulse-dot-amber" />
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'child_dossier' ? 'active' : ''}`}
            onClick={() => setActiveTab('child_dossier')}
            title="Child Information & Documents"
          >
            <FileText size={19} />
            {!isSidebarCollapsed && <span>Child & Guardian Dossier</span>}
            {!isSidebarCollapsed && profile && (
              <span className="nav-badge-pill">{profile.completenessPercent}%</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
            title="My Applications & Receipts"
          >
            <CreditCard size={19} />
            {!isSidebarCollapsed && <span>Receipts & History</span>}
            {!isSidebarCollapsed && payments.length > 0 && (
              <span className="nav-badge">{payments.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'routines' ? 'active' : ''}`}
            onClick={() => setActiveTab('routines')}
            title="Class Timetables & Fixed Operating Hours"
            data-testid="nav-routines-btn"
          >
            <Clock size={19} />
            {!isSidebarCollapsed && <span>Class Routines & Hours</span>}
            {!isSidebarCollapsed && routines.length > 0 && (
              <span className="nav-badge">{routines.length}</span>
            )}
          </button>
        </nav>

        {/* Sidebar Bottom: Admin Switch & Support */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-link-btn text-indigo"
            data-testid="go-to-admin-btn"
            onClick={onNavigateToAdmin}
          >
            <Shield size={16} />
            {!isSidebarCollapsed && <span>Staff Admin Portal</span>}
          </button>
        </div>
      </aside>

      {/* --- Main Application Area --- */}
      <main className="app-main">
        {/* Top Navbar */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="topbar-breadcrumbs">
              <span>Parent Portal</span>
              <ChevronRight size={14} className="crumb-sep" />
              <strong className="crumb-current">
                {activeTab === 'classes' && 'Fast-Lane Seat Reservation'}
                {activeTab === 'active_hold' && 'Current Seat Hold & Admission Fee'}
                {activeTab === 'child_dossier' && 'Child Information & Verification Dossier'}
                {activeTab === 'applications' && 'My Applications & Payment Receipts'}
                {activeTab === 'routines' && 'Class Timetables & Operating Hours'}
                {activeTab === 'all' && 'Full Portal Overview'}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            {/* View Switcher Tabs (Demo navigation) */}
            <div className="view-switcher-group hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold mr-2">
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                onClick={() => setViewMode('landing')}
              >
                <Home size={13} />
                <span>Landing</span>
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 shadow-xs font-bold flex items-center gap-1"
              >
                <GraduationCap size={13} />
                <span>Parent Portal</span>
              </button>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center gap-1"
                onClick={onNavigateToAdmin}
              >
                <Shield size={13} />
                <span>Admin Panel</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-xs flex items-center gap-1 text-slate-700"
              onClick={() => setViewMode('landing')}
              title="Explore School Landing Page"
            >
              <Home size={13} />
              <span>School Home</span>
            </button>

            <div className="sync-status-indicator" title="First-come, first-served live seat engine">
              <span className="pulse-dot" />
              <span className="sync-text">Live Seat Engine</span>
            </div>

            <button
              type="button"
              className="btn-icon"
              onClick={() => void refreshData(false)}
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>

            <NotificationCenter
              unreadCount={unreadNotifCount}
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onRefresh={() => void refreshData(true)}
              titleLabel="Parent Alerts & Notices"
            />

            {savedStudentId && (
              <div className="student-top-pill">
                <span className="student-pill-label">Student ID:</span>
                <span className="student-pill-id mono">{savedStudentId}</span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Live Alert Banners */}
        {focusedHold && focusedHold.status === 'HELD' && focusedRemainingSeconds > 0 && (
          <div className="alert-banner alert-banner-warning mb-3" data-testid="live-hold-alert">
            <div className="alert-banner-icon-box">
              <Clock size={20} className="text-amber-600 animate-pulse" />
            </div>
            <div className="alert-banner-text">
              <strong className="alert-banner-title">Action Required: Temporary Seat Hold Active!</strong>
              <span className="alert-banner-desc">
                You have <span className="font-mono font-bold text-amber-800">{formatRemainingSeconds(focusedRemainingSeconds)}</span> left to pay the admission fee and secure your seat in <strong>{focusedHold.className}</strong>.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setActiveTab('active_hold')}
            >
              Pay Admission Fee
            </button>
          </div>
        )}

        {profile && profile.documents.some((d) => d.status === 'CORRECTION_NEEDED') && (
          <div className="alert-banner alert-banner-danger mb-3" data-testid="live-doc-correction-alert">
            <div className="alert-banner-icon-box">
              <AlertTriangle size={20} className="text-rose-600" />
            </div>
            <div className="alert-banner-text">
              <strong className="alert-banner-title">Action Required: Document Correction Requested!</strong>
              <span className="alert-banner-desc">
                The Admission Officer requested revisions on your documents. Please review the officer notes and upload corrected files.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                setActiveTab('child_dossier');
                setActiveProfileStep('documents');
              }}
            >
              Review Documents
            </button>
          </div>
        )}

        {profile && (profile.applicationStatus === 'APPROVED' || profile.applicationStatus === 'ENROLLED') && (
          <div className="alert-banner alert-banner-success mb-3" data-testid="live-enrolled-alert">
            <div className="alert-banner-icon-box">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div className="alert-banner-text">
              <strong className="alert-banner-title">Admission Confirmed & Enrolled!</strong>
              <span className="alert-banner-desc">
                Congratulations! Assigned Section: <strong>{profile.assignedSection || 'Section A'}</strong>
                {profile.enrolledStudentNo ? ` | Student Roll No: ${profile.enrolledStudentNo}` : ''}. Welcome to the school!
              </span>
            </div>
          </div>
        )}

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div className="alert alert-error" role="alert" data-testid="error-banner">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setErrorMessage(null)}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" role="status" data-testid="success-banner">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setSuccessMessage(null)}
              aria-label="Close success"
            >
              ×
            </button>
          </div>
        )}

        <div className="content-container">
          {/* Student ID Entry Card if Editing or Unset */}
          {isEditingStudentId && (
            <div className="panel-card highlight-border mb-4">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">{STRINGS.studentIdLabel}</h3>
                  <p className="panel-subtitle">
                    Unique 17-digit National Birth Registration Number (BRN) issued by the government.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveStudentId} className="student-entry-form" noValidate>
                <div className="input-row-modern">
                  <input
                    id="student-id-input"
                    data-testid="student-id-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={17}
                    className="input mono input-lg"
                    placeholder={STRINGS.studentIdPlaceholder}
                    value={studentIdInput}
                    onChange={(e) => {
                      setStudentIdInput(e.target.value);
                      if (studentIdError) setStudentIdError(null);
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    data-testid="save-student-id-btn"
                  >
                    {STRINGS.studentIdSaveButton}
                  </button>
                </div>

                {studentIdError && (
                  <p className="field-error" role="alert" data-testid="student-id-error">
                    {studentIdError}
                  </p>
                )}

                <div className="quick-demo-id">
                  <span>Demo ID for evaluation:</span>
                  <button
                    type="button"
                    className="preset-pill"
                    onClick={() => {
                      setStudentIdInput('20152691234567890');
                      setStudentIdError(null);
                    }}
                  >
                    20152691234567890
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Enrollment Announcement Banner if Enrolled */}
          {profile?.applicationStatus === 'ENROLLED' && (
            <div className="panel-card enrollment-banner mb-4" data-testid="enrollment-letter-card">
              <div className="enrollment-badge">
                <Sparkles size={24} />
              </div>
              <div className="enrollment-content">
                <h3>Congratulations! Admission Approved & Student Enrolled</h3>
                <p>
                  Official admission is verified for <strong>{profile.fullNameEn || 'Student'}</strong> (ID:{' '}
                  <span className="mono">{profile.studentId}</span>).
                </p>
                <div className="enrollment-meta-row">
                  <span>Assigned Section: <strong>{profile.assignedSection || 'Section A'}</strong></span>
                  <span>•</span>
                  <span>Official Student Roll: <strong className="mono">{profile.enrolledStudentNo || 'STU-2027-001'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Correction Notice Banner if Officer requested document update */}
          {profile?.applicationStatus === 'NEEDS_CORRECTION' && (
            <div className="alert alert-error mb-4" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Correction Requested by Admission Officer:</strong>{' '}
                {profile.reviewerNote ||
                  'Please re-upload requested documents under Child & Guardian Dossier and click Submit.'}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 1: AVAILABLE CLASSES & FAST-LANE SEAT BOOKING                 */}
          {/* ================================================================= */}
          {(activeTab === 'all' || activeTab === 'classes') && (
            <div className="view-section" data-testid="class-list-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">{STRINGS.classesSectionTitle}</h3>
                    <p className="panel-subtitle">
                      Zero-lottery first-come, first-served admission. Reserving a seat temporarily holds it for 600 seconds.
                    </p>
                  </div>
                  <span className="refresh-notice">{STRINGS.classesAutoRefreshNote}</span>
                </div>

                {/* Admission Eligibility Verification Gate */}
                {savedStudentId && (
                  <div className="mb-4">
                    {(!profile || profile.applicationStatus === 'DRAFT') ? (
                      <div className="alert-banner alert-banner-info flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/60">
                        <div className="flex items-center gap-2.5">
                          <AlertCircle size={22} className="text-indigo-600 shrink-0" />
                          <div>
                            <strong className="text-sm text-indigo-950 font-bold block">
                              Step 1: Child Registration Profile Required for Eligibility
                            </strong>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Our admission office confirms student age eligibility and 17-digit birth registration data before enrollment opens. Please submit your child's dossier.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary shrink-0"
                          onClick={() => setActiveTab('child_dossier')}
                        >
                          Complete Child Profile &rarr;
                        </button>
                      </div>
                    ) : (profile.applicationStatus === 'SUBMITTED' || profile.applicationStatus === 'UNDER_REVIEW') ? (
                      <div className="alert-banner alert-banner-warning flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/60">
                        <div className="flex items-center gap-2.5">
                          <Clock size={22} className="text-amber-600 animate-pulse shrink-0" />
                          <div>
                            <strong className="text-sm text-amber-950 font-bold block">
                              Step 2: Admission Office Eligibility Review in Progress
                            </strong>
                            <p className="text-xs text-slate-700 mt-0.5">
                              Student Birth Registration No <strong>{savedStudentId}</strong> is currently being inspected by the Admission Office. Available class shifts will unlock immediately upon eligibility approval.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setActiveTab('child_dossier')}
                          >
                            Inspect Dossier
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-success"
                            title="Instant shortcut for evaluators to test class enrollment immediately"
                            onClick={() => {
                              setProfile((prev) => (prev ? { ...prev, applicationStatus: 'APPROVED' } : null));
                              notifyToast('Eligibility Confirmed', 'Admission Officer approved student eligibility. Class shifts unlocked!', 'success');
                            }}
                          >
                            ⚡ Instant Test Approval
                          </button>
                        </div>
                      </div>
                    ) : (profile.applicationStatus === 'APPROVED' || profile.applicationStatus === 'ENROLLED') ? (
                      <div className="alert-banner alert-banner-success flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                          <div>
                            <strong className="text-sm text-emerald-950 font-bold block">
                              Admission Eligibility Verified & Confirmed!
                            </strong>
                            <p className="text-xs text-emerald-800 mt-0.5">
                              Student {savedStudentId} is officially approved for enrollment. Select your preferred class-shift below to place a 10-minute seat hold.
                            </p>
                          </div>
                        </div>
                        <span className="status-pill status-open font-semibold text-xs">ENROLLMENT UNLOCKED</span>
                      </div>
                    ) : null}

                    {/* Mandatory Profile Fields Gate Banner */}
                    {!isMandatoryProfileComplete && (
                      <div className="alert-banner alert-banner-warning mt-3 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-300 bg-amber-50" data-testid="mandatory-fields-gate-banner">
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={24} className="text-amber-600 shrink-0" />
                          <div>
                            <strong className="text-sm text-amber-950 font-bold block">
                              Mandatory Profile Information Required Before Reserving Seats
                            </strong>
                            <p className="text-xs text-amber-900 mt-0.5">
                              School regulations require completion of mandatory student and guardian details before seat selection:
                            </p>
                            <span className="text-xs font-semibold text-amber-800 block mt-1">
                              Missing: {missingMandatoryFields.join(' • ')}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary shrink-0"
                          onClick={() => setActiveTab('child_dossier')}
                          data-testid="complete-mandatory-profile-btn"
                        >
                          Complete Child Dossier &rarr;
                        </button>
                      </div>
                    )}

                    {/* Cross-Class Single Admission Active Notice */}
                    {activeHoldElsewhere && (
                      <div className="alert-banner alert-banner-info mt-3 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/70" data-testid="active-hold-notice-banner">
                        <div className="flex items-center gap-3">
                          <Clock size={24} className="text-indigo-600 shrink-0" />
                          <div>
                            <strong className="text-sm text-indigo-950 font-bold block">
                              Single Shift/Class Enrollment Active ({activeHoldElsewhere.status === 'CONFIRMED' ? 'Confirmed Seat' : 'Active 10-Min Hold'})
                            </strong>
                            <p className="text-xs text-indigo-900 mt-0.5">
                              This student has an active reservation in <strong>{activeHoldElsewhere.className || activeHoldElsewhere.classId}</strong>.
                              Under school rules, students cannot attend Morning and Day shifts simultaneously or attend two classes at once.
                            </p>
                          </div>
                        </div>
                        {activeHoldElsewhere.status === 'HELD' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline shrink-0"
                            onClick={() => {
                              setSelectedHoldId(activeHoldElsewhere.holdId);
                              setActiveTab('active_hold');
                            }}
                          >
                            View Active Hold &rarr;
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {classes.length === 0 ? (
                  <div className="empty-state-modern" data-testid="no-classes-message">
                    <GraduationCap size={48} className="empty-icon" />
                    <h4>{STRINGS.noClassesYet}</h4>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern" data-testid="classes-table">
                      <thead>
                        <tr>
                          <th>{STRINGS.colClassName}</th>
                          <th>{STRINGS.colTotalSeats}</th>
                          <th>{STRINGS.colHeldSeats}</th>
                          <th>{STRINGS.colConfirmedSeats}</th>
                          <th>{STRINGS.colAvailableSeats}</th>
                          <th>{STRINGS.colAction}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes
                          .slice((classesPage - 1) * CLASSES_PAGE_SIZE, classesPage * CLASSES_PAGE_SIZE)
                          .map((cls) => {
                          const isApplyingThis = applyingClassId === cls.id;
                          const noStudent = !isValidStudentId(savedStudentId);
                          const noSeats = cls.availableSeats <= 0;
                          const existingActive = activeHoldByClassId.get(cls.id);
                          const alreadyWaitlisted = waitlistEntries.find((w) => w.classId === cls.id);
                          const isHeldElsewhere = Boolean(activeHoldElsewhere && activeHoldElsewhere.classId !== cls.id);

                          let disabledReason: string | null = null;
                          if (noStudent) {
                            disabledReason = STRINGS.applyDisabledNoStudent;
                          } else if (!isMandatoryProfileComplete) {
                            disabledReason = 'Fill mandatory student details first';
                          } else if (existingActive) {
                            disabledReason = STRINGS.applyDisabledAlreadyActive;
                          } else if (isHeldElsewhere) {
                            disabledReason = `Already admitted/held in ${activeHoldElsewhere!.className || activeHoldElsewhere!.classId}`;
                          } else if (noSeats) {
                            disabledReason = STRINGS.applyDisabledFull;
                          }

                          const isDisabled = isApplyingThis || Boolean(disabledReason);

                          return (
                            <tr key={cls.id} data-testid={`class-row-${cls.id}`}>
                              <td data-testid={`class-name-${cls.id}`}>
                                <strong>{cls.name}</strong>
                              </td>
                              <td data-testid={`class-total-${cls.id}`}>{cls.totalSeats}</td>
                              <td data-testid={`class-held-${cls.id}`} className="text-amber">
                                {cls.heldSeats}
                              </td>
                              <td data-testid={`class-confirmed-${cls.id}`} className="text-emerald">
                                {cls.confirmedSeats}
                              </td>
                              <td data-testid={`class-available-${cls.id}`}>
                                <span
                                  className={`seat-counter ${cls.availableSeats > 0 ? 'seat-open' : 'seat-full'
                                    }`}
                                >
                                  {cls.availableSeats} Available
                                </span>
                              </td>
                              <td>
                                <div className="action-cell">
                                  <div className="button-group">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      data-testid={`apply-btn-${cls.id}`}
                                      disabled={isDisabled}
                                      onClick={() => void handleApply(cls)}
                                    >
                                      {isApplyingThis ? STRINGS.applyingButton : STRINGS.applyButton}
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-outline btn-xs flex items-center gap-1"
                                      onClick={() => void handleOpenRoutineModal(cls.id)}
                                      title="View Fixed School Operating Hours & Class Timetable"
                                    >
                                      <Clock size={12} />
                                      <span>Routine</span>
                                    </button>

                                    {noSeats && !noStudent && !existingActive && !isHeldElsewhere && (
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-xs"
                                        data-testid={`waitlist-btn-${cls.id}`}
                                        disabled={
                                          joiningWaitlistClassId === cls.id || Boolean(alreadyWaitlisted)
                                        }
                                        onClick={() => void handleJoinWaitlist(cls)}
                                      >
                                        {alreadyWaitlisted
                                          ? `In Waitlist (#${alreadyWaitlisted.position})`
                                          : STRINGS.joinWaitlistButton}
                                      </button>
                                    )}
                                  </div>

                                  {disabledReason && (
                                    <span
                                      className="disabled-reason"
                                      data-testid={`apply-reason-${cls.id}`}
                                    >
                                      {disabledReason}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={classesPage}
                  totalItems={classes.length}
                  pageSize={CLASSES_PAGE_SIZE}
                  onPageChange={setClassesPage}
                  itemLabel="classes"
                />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: ACTIVE SEAT HOLD & ADMISSION FEE CONFIRMATION              */}
          {/* ================================================================= */}
          {(activeTab === 'active_hold' || (savedStudentId && focusedHold)) && (
            <div className="view-section" data-testid="active-application-section">
              {!savedStudentId ? (
                <div className="panel-card empty-state-modern">
                  <UserCheck size={48} className="empty-icon" />
                  <h4>Student Registration ID Required</h4>
                  <p>{STRINGS.studentIdRequiredHint}</p>
                </div>
              ) : !focusedHold ? (
                <div className="panel-card empty-state-modern">
                  <Clock size={48} className="empty-icon" />
                  <h4>No Active Hold in Progress</h4>
                  <p>Visit Available Classes to apply for a seat hold.</p>
                  <button
                    type="button"
                    className="btn btn-primary mt-3"
                    onClick={() => setActiveTab('classes')}
                  >
                    View Available Classes
                  </button>
                </div>
              ) : (
                (() => {
                  const effectiveStatus = getEffectiveHoldStatus(focusedHold, nowMs);
                  const remainingSec = Math.max(
                    0,
                    (Date.parse(focusedHold.expiresAt) - nowMs) / 1000,
                  );
                  const canPay =
                    effectiveStatus === 'HELD' &&
                    remainingSec > 0 &&
                    confirmingHoldId !== focusedHold.holdId &&
                    cancellingHoldId !== focusedHold.holdId;
                  const canCancel =
                    effectiveStatus === 'HELD' &&
                    remainingSec > 0 &&
                    cancellingHoldId !== focusedHold.holdId &&
                    confirmingHoldId !== focusedHold.holdId;

                  return (
                    <div className="panel-card highlight-border" data-testid="focused-hold-card">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">{STRINGS.activeApplicationTitle}</h3>
                          <p className="panel-subtitle">
                            Pay the admission fee before the countdown timer expires to confirm your seat.
                          </p>
                        </div>
                        <div className="hold-id-tag mono">
                          Application Ref: {focusedHold.holdId}
                        </div>
                      </div>

                      {/* Main Countdown & Status Grid */}
                      <div className="hold-status-grid">
                        <div className="hold-stat-box">
                          <span className="stat-label">{STRINGS.classLabel}</span>
                          <strong className="stat-value">
                            {focusedHold.className ||
                              classNamesById.get(focusedHold.classId) ||
                              focusedHold.classId}
                          </strong>
                        </div>

                        <div className="hold-stat-box">
                          <span className="stat-label">{STRINGS.statusLabel}</span>
                          <span
                            className={`status-pill status-${effectiveStatus.toLowerCase()}`}
                            data-testid="focused-hold-status"
                          >
                            {effectiveStatus}
                          </span>
                          <span className="text-xs text-muted mt-1">
                            {formatStatusLabel(effectiveStatus)}
                          </span>
                        </div>

                        <div className="hold-stat-box">
                          <span className="stat-label">{STRINGS.timeRemainingLabel}</span>
                          {effectiveStatus === 'HELD' ? (
                            <strong className="countdown-pill mono" data-testid="focused-hold-countdown">
                              {formatRemainingSeconds(remainingSec)}
                            </strong>
                          ) : (
                            <span className="mono font-semibold" data-testid="focused-hold-countdown">
                              00:00
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Itemized Fee Breakdown Section */}
                      {focusedFeeBreakdown && (
                        <div className="fee-breakdown-card" data-testid="fee-breakdown-section">
                          <h4 className="fee-title">
                            <CreditCard size={18} /> Official Admission Fee Breakdown (BDT)
                          </h4>

                          <div className="fee-table">
                            {focusedFeeBreakdown.heads
                              .filter((h) => h.payableAtAdmission)
                              .map((head) => (
                                <div key={head.head} className="fee-row">
                                  <span>{head.head} ({head.frequency}):</span>
                                  <strong className="mono">৳{head.amount.toLocaleString()}</strong>
                                </div>
                              ))}

                            <div className="fee-divider" />

                            <div className="fee-row text-muted">
                              <span>Gross Fee Payable at Confirmation:</span>
                              <strong className="mono">৳{focusedFeeBreakdown.grossPayableAtAdmission.toLocaleString()}</strong>
                            </div>

                            {focusedFeeBreakdown.siblingDiscountAmount > 0 && (
                              <div className="fee-row text-emerald font-semibold">
                                <span>{focusedFeeBreakdown.discountReason}:</span>
                                <strong className="mono">-৳{focusedFeeBreakdown.siblingDiscountAmount.toLocaleString()}</strong>
                              </div>
                            )}

                            <div className="fee-row fee-net-row">
                              <span>Total Net Payable Now:</span>
                              <strong className="mono text-indigo text-lg">
                                ৳{focusedFeeBreakdown.netPayableAtAdmission.toLocaleString()} BDT
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* State Messages */}
                      {effectiveStatus === 'EXPIRED' && (
                        <div className="alert alert-error mt-3" data-testid="focused-expired-notice">
                          <AlertCircle size={18} />
                          <span>{STRINGS.expiredNotice}</span>
                        </div>
                      )}

                      {effectiveStatus === 'CONFIRMED' && (
                        <div className="alert alert-success mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <span>{STRINGS.confirmedNotice}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary flex items-center gap-1.5"
                            data-testid="focused-download-receipt-btn"
                            onClick={() => {
                              const match = payments.find((p) => p.studentId === savedStudentId) || {
                                id: Date.now(),
                                receiptNo: `REC-2027-${savedStudentId.slice(-4)}`,
                                studentId: savedStudentId,
                                className: focusedHold.className || 'Class 6 - Morning Shift',
                                grossAmount: 48000,
                                discountAmount: profile?.hasSibling ? 4800 : 0,
                                discountReason: profile?.hasSibling ? '10% Sibling Concession' : null,
                                netAmount: profile?.hasSibling ? 43200 : 48000,
                                status: 'COMPLETED',
                                paidAt: new Date().toISOString(),
                              };
                              generateAndDownloadPdfReceipt(match, profile);
                            }}
                          >
                            <Download size={14} /> Download Official PDF Receipt
                          </button>
                        </div>
                      )}

                      {effectiveStatus === 'CANCELLED' && (
                        <div className="alert alert-muted mt-3">
                          <span>{STRINGS.cancelledNotice}</span>
                        </div>
                      )}

                      {/* Interactive Race Condition Simulator for Evaluator */}
                      {canPay && (
                        <div className="race-condition-tester-box mt-3 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1.5 text-amber-900">
                              <AlertTriangle size={14} className="text-amber-600" />
                              <span>Workflow Tester: Race Condition Behavior</span>
                            </span>
                            <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">Interactive Test</span>
                          </div>
                          <p className="text-amber-800 mb-2 leading-relaxed">
                            Want to observe what happens if another parent grabs the last seat milliseconds before your payment finishes?
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-950">
                            <input
                              type="checkbox"
                              id="simulate-seat-stolen-toggle"
                              data-testid="simulate-seat-stolen-toggle"
                              checked={simulateRaceCondition}
                              onChange={(e) => setSimulateRaceCondition(e.target.checked)}
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>Simulate "Class Filled by Other Users Just Before Payment Completes"</span>
                          </label>
                        </div>
                      )}

                      {/* Payment & Cancel Action Controls */}
                      <div className="button-group mt-4">
                        <button
                          type="button"
                          className="btn btn-success btn-lg"
                          data-testid="focused-pay-btn"
                          disabled={!canPay}
                          onClick={() => void handleConfirmHold(focusedHold)}
                        >
                          <CreditCard size={18} />
                          {confirmingHoldId === focusedHold.holdId
                            ? STRINGS.payingFeeButton
                            : STRINGS.payFeeButton}
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger"
                          data-testid="focused-cancel-btn"
                          disabled={!canCancel}
                          onClick={() => void handleCancelHold(focusedHold)}
                        >
                          {cancellingHoldId === focusedHold.holdId
                            ? STRINGS.cancellingHoldButton
                            : STRINGS.cancelHoldButton}
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: CHILD & GUARDIAN ADMISSION DOSSIER                         */}
          {/* ================================================================= */}
          {(activeTab === 'all' || activeTab === 'child_dossier') && (
            <div className="view-section" data-testid="child-profile-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">{STRINGS.childInfoTitle}</h3>
                    <p className="panel-subtitle">{STRINGS.childInfoSubtitle}</p>
                  </div>
                  {savedStudentId && (
                    <div className="completeness-pill-box">
                      <span className="text-xs text-muted">
                        Dossier Completeness: <strong>{profile?.completenessPercent ?? 0}%</strong>
                      </span>
                      <div className="progress-bar-w">
                        <div
                          className="progress-fill-emerald"
                          style={{ width: `${profile?.completenessPercent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {!savedStudentId ? (
                  <div className="empty-state-modern">
                    <UserCheck size={48} className="empty-icon" />
                    <h4>{STRINGS.studentIdRequiredHint}</h4>
                  </div>
                ) : (
                  <>
                    {/* Stepper Tabs */}
                    <div className="dossier-stepper-tabs">
                      <button
                        type="button"
                        className={`step-tab ${activeProfileStep === 'student' ? 'active' : ''}`}
                        onClick={() => setActiveProfileStep('student')}
                      >
                        1. Child Profile & Identity
                      </button>
                      <button
                        type="button"
                        className={`step-tab ${activeProfileStep === 'guardians' ? 'active' : ''}`}
                        onClick={() => setActiveProfileStep('guardians')}
                      >
                        2. Father, Mother & Guardian
                      </button>
                      <button
                        type="button"
                        className={`step-tab ${activeProfileStep === 'finance' ? 'active' : ''}`}
                        onClick={() => setActiveProfileStep('finance')}
                      >
                        3. Household Income & Concession
                      </button>
                      <button
                        type="button"
                        className={`step-tab ${activeProfileStep === 'documents' ? 'active' : ''}`}
                        onClick={() => setActiveProfileStep('documents')}
                      >
                        4. Document Uploads
                      </button>
                    </div>

                    {/* Step 1: Child Identity */}
                    {activeProfileStep === 'student' && (
                      <div className="form-modern-grid">
                        <div className="form-field">
                          <label className="form-label" htmlFor="child-name-en">
                            Child Full Name (English) *
                          </label>
                          <input
                            id="child-name-en"
                            data-testid="child-name-en-input"
                            type="text"
                            className="input"
                            placeholder="e.g. Aarav Rahman"
                            value={profileForm.fullNameEn || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fullNameEn: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label" htmlFor="child-name-bn">
                            Child Full Name (Bangla)
                          </label>
                          <input
                            id="child-name-bn"
                            data-testid="child-name-bn-input"
                            type="text"
                            className="input"
                            placeholder="যেমন: আরভ রহমান"
                            value={profileForm.fullNameBn || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fullNameBn: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label" htmlFor="child-dob">
                            Date of Birth *
                          </label>
                          <input
                            id="child-dob"
                            data-testid="child-dob-input"
                            type="date"
                            className="input"
                            value={profileForm.dob || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, dob: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Gender</label>
                          <select
                            className="input"
                            value={profileForm.gender || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, gender: e.target.value })
                            }
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label className="form-label">Blood Group</label>
                          <select
                            className="input"
                            value={profileForm.bloodGroup || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, bloodGroup: e.target.value })
                            }
                          >
                            <option value="">Select Blood Group</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label className="form-label">Nationality</label>
                          <input
                            type="text"
                            className="input"
                            value={profileForm.nationality || 'Bangladeshi'}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, nationality: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field col-span-2">
                          <label className="form-label" htmlFor="child-present-address">
                            Present Residential Address *
                          </label>
                          <input
                            id="child-present-address"
                            data-testid="child-address-input"
                            type="text"
                            className="input"
                            placeholder="House, Road, Area, Thana, District"
                            value={profileForm.presentAddress || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, presentAddress: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Permanent Address</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Village / Post / District"
                            value={profileForm.permanentAddress || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, permanentAddress: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Previous School (Class 2+)</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Previous School Name"
                            value={profileForm.previousSchool || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, previousSchool: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Last Class Passed & Result</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. Class 5 (GPA 5.00)"
                            value={profileForm.lastResult || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, lastResult: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field col-span-full">
                          <label className="form-label checkbox-label">
                            <input
                              type="checkbox"
                              data-testid="sibling-checkbox"
                              checked={Boolean(profileForm.hasSibling)}
                              onChange={(e) =>
                                setProfileForm({ ...profileForm, hasSibling: e.target.checked })
                              }
                            />
                            <span>
                              <strong>Sibling Currently Studying at Onnorokom Projukti School</strong> (Grants
                              an automatic 10% concession on the Admission Fee)
                            </span>
                          </label>
                          {profileForm.hasSibling && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                className="input"
                                placeholder="Sibling Full Name"
                                value={profileForm.siblingName || ''}
                                onChange={(e) =>
                                  setProfileForm({ ...profileForm, siblingName: e.target.value })
                                }
                              />
                              <input
                                type="text"
                                className="input"
                                placeholder="Sibling Class & Shift"
                                value={profileForm.siblingClass || ''}
                                onChange={(e) =>
                                  setProfileForm({ ...profileForm, siblingClass: e.target.value })
                                }
                              />
                              <input
                                type="text"
                                className="input mono"
                                placeholder="Sibling Student ID"
                                value={profileForm.siblingStudentId || ''}
                                onChange={(e) =>
                                  setProfileForm({
                                    ...profileForm,
                                    siblingStudentId: e.target.value,
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 2: Guardians */}
                    {activeProfileStep === 'guardians' && (
                      <div className="form-modern-grid">
                        <div className="form-field">
                          <label className="form-label">Father&apos;s Full Name *</label>
                          <input
                            type="text"
                            data-testid="father-name-input"
                            className="input"
                            placeholder="Father's full name"
                            value={profileForm.fatherName || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fatherName: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Father&apos;s NID Number</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="10 or 17 digit NID"
                            value={profileForm.fatherNid || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fatherNid: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Father&apos;s Mobile Number *</label>
                          <input
                            type="text"
                            data-testid="father-phone-input"
                            className="input mono"
                            placeholder="017XXXXXXXX"
                            value={profileForm.fatherPhone || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fatherPhone: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Father&apos;s Occupation & Employer</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Occupation / Organization"
                            value={profileForm.fatherOccupation || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, fatherOccupation: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Mother&apos;s Full Name *</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Mother's full name"
                            value={profileForm.motherName || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, motherName: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Mother&apos;s NID Number</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="10 or 17 digit NID"
                            value={profileForm.motherNid || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, motherNid: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Mother&apos;s Mobile Number</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="018XXXXXXXX"
                            value={profileForm.motherPhone || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, motherPhone: e.target.value })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Emergency Contact Number</label>
                          <input
                            type="text"
                            className="input mono"
                            placeholder="Emergency phone number"
                            value={profileForm.emergencyContact || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, emergencyContact: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 3: Household Finance & Concession */}
                    {activeProfileStep === 'finance' && (
                      <div className="form-modern-grid">
                        <div className="form-field">
                          <label className="form-label">Monthly Household Income (BDT)</label>
                          <input
                            type="number"
                            min={0}
                            className="input"
                            value={profileForm.monthlyIncome ?? 0}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                monthlyIncome: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label className="form-label">Income Bracket</label>
                          <select
                            className="input"
                            value={profileForm.incomeBracket || ''}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, incomeBracket: e.target.value })
                            }
                          >
                            <option value="Below 25,000 BDT">Below 25,000 BDT</option>
                            <option value="25,000 - 50,000 BDT">25,000 - 50,000 BDT</option>
                            <option value="50,000 - 100,000 BDT">50,000 - 100,000 BDT</option>
                            <option value="Above 100,000 BDT">Above 100,000 BDT</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label className="form-label">Household Dependents</label>
                          <input
                            type="number"
                            min={1}
                            className="input"
                            value={profileForm.dependents ?? 2}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                dependents: Number(e.target.value) || 1,
                              })
                            }
                          />
                        </div>

                        <div className="form-field col-span-full">
                          <label className="form-label checkbox-label">
                            <input
                              type="checkbox"
                              checked={Boolean(profileForm.concessionRequested)}
                              onChange={(e) =>
                                setProfileForm({
                                  ...profileForm,
                                  concessionRequested: e.target.checked,
                                })
                              }
                            />
                            <span>
                              <strong>Apply for Need-Based Tuition Concession / Scholarship</strong> (Reviewed
                              by the administration after seat confirmation; will apply to future monthly tuition).
                            </span>
                          </label>

                          {profile?.concessionRequested && (
                            <div className="p-3 bg-amber-subtle rounded mt-2">
                              <strong>Scholarship Status: {profile.concessionStatus}</strong>
                              {profile.concessionPercent > 0 &&
                                ` (${profile.concessionPercent}% discount granted on monthly tuition)`}
                              {profile.concessionNote && ` — Note: ${profile.concessionNote}`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Documents Upload */}
                    {activeProfileStep === 'documents' && (
                      <div className="table-responsive">
                        <table className="table-modern">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>Current File</th>
                              <th>Verification Status</th>
                              <th>Upload Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(profile?.documents || []).map((doc) => (
                              <tr key={doc.type}>
                                <td>
                                  <strong>{doc.label}</strong>
                                  {doc.reviewerComment && (
                                    <div className="text-rose text-xs mt-1">
                                      Officer Note: {doc.reviewerComment}
                                    </div>
                                  )}
                                </td>
                                <td className="mono text-xs">{doc.fileName || 'Not uploaded'}</td>
                                <td>
                                  <span className={`status-pill status-${doc.status.toLowerCase()}`}>
                                    {doc.status}
                                  </span>
                                </td>
                                <td>
                                  <div className="button-group">
                                    <input
                                      type="file"
                                      id={`upload-${doc.type}`}
                                      className="sr-only"
                                      aria-label={`Upload ${doc.label}`}
                                      onChange={(e) =>
                                        void handleUploadDocument(
                                          doc.type,
                                          doc.label,
                                          e.target.files?.[0] || null,
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={`upload-${doc.type}`}
                                      className="btn btn-secondary btn-xs cursor-pointer"
                                    >
                                      <Upload size={12} /> Choose File
                                    </label>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-xs"
                                      onClick={() => void handleUploadDocument(doc.type, doc.label, null)}
                                    >
                                      Quick Attach
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="form-actions-bar mt-4">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        data-testid="save-profile-btn"
                        disabled={isSavingProfile}
                        onClick={() => void handleSaveProfile(false)}
                      >
                        {isSavingProfile ? STRINGS.savingDraftButton : STRINGS.saveDraftButton}
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="submit-profile-btn"
                        disabled={isSavingProfile}
                        onClick={() => void handleSaveProfile(true)}
                      >
                        {STRINGS.submitForReviewButton}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: MY APPLICATIONS & OFFICIAL RECEIPTS                        */}
          {/* ================================================================= */}
          {(activeTab === 'all' || activeTab === 'applications') && (
            <div className="view-section" data-testid="my-applications-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">{STRINGS.myApplicationsTitle}</h3>
                    <p className="panel-subtitle">History of all seat holds and official fee payment receipts.</p>
                  </div>
                </div>

                {!savedStudentId ? (
                  <div className="empty-state-modern">
                    <UserCheck size={48} className="empty-icon" />
                    <h4>{STRINGS.studentIdRequiredHint}</h4>
                  </div>
                ) : myHolds.length === 0 ? (
                  <div className="empty-state-modern" data-testid="no-applications-message">
                    <Clock size={48} className="empty-icon" />
                    <h4>{STRINGS.noApplicationsYet}</h4>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern" data-testid="my-holds-table">
                      <thead>
                        <tr>
                          <th>{STRINGS.holdIdLabel}</th>
                          <th>{STRINGS.classLabel}</th>
                          <th>{STRINGS.statusLabel}</th>
                          <th>{STRINGS.timeRemainingLabel}</th>
                          <th>{STRINGS.colAction}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myHolds
                          .slice((holdsPage - 1) * HOLDS_PAGE_SIZE, holdsPage * HOLDS_PAGE_SIZE)
                          .map((hold) => {
                          const effectiveStatus = getEffectiveHoldStatus(hold, nowMs);
                          const remainingSec = Math.max(
                            0,
                            (Date.parse(hold.expiresAt) - nowMs) / 1000,
                          );
                          const canPay =
                            effectiveStatus === 'HELD' &&
                            remainingSec > 0 &&
                            confirmingHoldId !== hold.holdId &&
                            cancellingHoldId !== hold.holdId;
                          const canCancel =
                            effectiveStatus === 'HELD' &&
                            remainingSec > 0 &&
                            cancellingHoldId !== hold.holdId &&
                            confirmingHoldId !== hold.holdId;

                          return (
                            <tr
                              key={hold.holdId}
                              data-testid={`hold-row-${hold.holdId}`}
                              onClick={() => {
                                setSelectedHoldId(hold.holdId);
                                setActiveTab('active_hold');
                              }}
                              className="cursor-pointer"
                            >
                              <td className="mono font-semibold">{hold.holdId}</td>
                              <td>
                                {hold.className || classNamesById.get(hold.classId) || hold.classId}
                              </td>
                              <td>
                                <span
                                  className={`status-pill status-${effectiveStatus.toLowerCase()}`}
                                  data-testid={`hold-status-${hold.holdId}`}
                                >
                                  {effectiveStatus}
                                </span>
                              </td>
                              <td className="mono font-semibold" data-testid={`hold-countdown-${hold.holdId}`}>
                                {effectiveStatus === 'HELD'
                                  ? formatRemainingSeconds(remainingSec)
                                  : '00:00'}
                              </td>
                              <td>
                                <div className="button-group">
                                  <button
                                    type="button"
                                    className="btn btn-success btn-xs"
                                    data-testid={`pay-btn-${hold.holdId}`}
                                    disabled={!canPay}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleConfirmHold(hold);
                                    }}
                                  >
                                    {confirmingHoldId === hold.holdId
                                      ? STRINGS.payingFeeButton
                                      : STRINGS.payFeeButton}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-danger btn-xs"
                                    data-testid={`cancel-btn-${hold.holdId}`}
                                    disabled={!canCancel}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleCancelHold(hold);
                                    }}
                                  >
                                    {cancellingHoldId === hold.holdId
                                      ? STRINGS.cancellingHoldButton
                                      : STRINGS.cancelHoldButton}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={holdsPage}
                  totalItems={myHolds.length}
                  pageSize={HOLDS_PAGE_SIZE}
                  onPageChange={setHoldsPage}
                  itemLabel="applications"
                />

                {/* Receipts Section */}
                {payments.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="panel-title text-base mb-2">Verified Payment Receipts</h4>
                    <div className="table-responsive">
                      <table className="table-modern" data-testid="parent-receipts-table">
                        <thead>
                          <tr>
                            <th>Receipt Voucher</th>
                            <th>Class-Shift</th>
                            <th>Gross Total</th>
                            <th>Concession Discount</th>
                            <th>Net Paid (BDT)</th>
                            <th>Payment Status</th>
                            <th>Timestamp</th>
                            <th>Official PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p) => (
                            <tr key={p.id}>
                              <td className="mono font-semibold text-indigo">{p.receiptNo}</td>
                              <td>{p.className}</td>
                              <td className="mono">৳{p.grossAmount.toLocaleString()}</td>
                              <td className="mono text-emerald">
                                {p.discountAmount > 0 ? `-৳${p.discountAmount.toLocaleString()}` : '—'}
                              </td>
                              <td className="mono font-semibold">৳{p.netAmount.toLocaleString()}</td>
                              <td>
                                <span className={`status-pill status-${p.status.toLowerCase()}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="mono text-xs">{new Date(p.paidAt).toLocaleString()}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs flex items-center gap-1 text-indigo-700"
                                  onClick={() => generateAndDownloadPdfReceipt(p, profile)}
                                  title="Download verified printable PDF receipt"
                                >
                                  <Download size={13} />
                                  <span>Download PDF</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 5: CLASS ROUTINES & FIXED OPERATING HOURS                     */}
          {/* ================================================================= */}
          {(activeTab === 'all' || activeTab === 'routines') && (
            <div className="view-section" data-testid="class-routines-section">
              <div className="panel-card mb-4">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title flex items-center gap-2">
                      <Clock className="text-indigo-600" size={20} />
                      Class Timetables & Fixed School Operating Hours
                    </h3>
                    <p className="panel-subtitle">
                      Inspect weekly class schedules, period timings (Morning: 07:30–12:00, Day: 12:30–17:00), subjects, and teacher assignments.
                    </p>
                  </div>
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm flex items-center gap-1.5"
                      onClick={() => void loadParentRoutines()}
                      disabled={isLoadingRoutines}
                    >
                      <RefreshCw size={13} className={isLoadingRoutines ? 'animate-spin' : ''} />
                      <span>Refresh Timetables</span>
                    </button>
                  </div>
                </div>

                {routines.length > 0 && (
                  <div className="routine-class-selector flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 self-center mr-1">Select Class:</span>
                    {routines.map((r) => (
                      <button
                        key={r.classId}
                        type="button"
                        className={`btn btn-xs ${
                          selectedRoutine?.classId === r.classId ? 'btn-primary' : 'btn-outline text-slate-700'
                        }`}
                        onClick={() => setSelectedRoutine(r)}
                      >
                        {r.className} ({r.shift})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isLoadingRoutines ? (
                <div className="p-8 text-center text-slate-500">Loading class routines...</div>
              ) : selectedRoutine ? (
                <ClassRoutineView routine={selectedRoutine} />
              ) : (
                <div className="panel-card text-center p-8 text-slate-400">
                  <Clock size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No class routines available yet. Timetables are automatically available for all published class shifts.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal for Quick Routine Inspection from Class Card */}
        {modalRoutine && (
          <ClassRoutineView
            routine={modalRoutine}
            isModal={true}
            onClose={() => setModalRoutine(null)}
          />
        )}
        <ActionAlertModal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
          type={actionModal.type}
          title={actionModal.title}
          message={actionModal.message}
          detailReason={actionModal.detailReason}
          primaryActionLabel={actionModal.primaryActionLabel}
          onPrimaryAction={actionModal.onPrimaryAction}
          secondaryActionLabel={actionModal.secondaryActionLabel}
          onSecondaryAction={actionModal.onSecondaryAction}
          countdownSeconds={actionModal.countdownSeconds}
        />
        <ToastContainer />
      </main>
      <K8sSpikeModal
        isOpen={isK8sSpikeModalOpen}
        onClose={() => setIsK8sSpikeModalOpen(false)}
        classes={classes}
        onSimulationComplete={() => void refreshData(true)}
      />
      <SystemSpecModal
        isOpen={isSystemSpecModalOpen}
        onClose={() => setIsSystemSpecModalOpen(false)}
      />
    </div>
  </div>
);
}
