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
} from 'lucide-react';
import { AdminPortal } from './AdminPortal';
import { api, ApiClientError, getServerNowMs } from './api';
import { POLL_INTERVAL_MS, STUDENT_ID_STORAGE_KEY } from './config';
import { STRINGS } from './strings';
import {
  ClassFeeBreakdown,
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

type ParentNavTab = 'all' | 'classes' | 'active_hold' | 'child_dossier' | 'applications';
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

  // --- In-flight Action States ---
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [confirmingHoldId, setConfirmingHoldId] = useState<string | null>(null);
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);
  const [joiningWaitlistClassId, setJoiningWaitlistClassId] = useState<string | null>(null);

  // --- Messages / Feedback ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      await refreshData(true);
    } catch (err) {
      showError(err);
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
      await api.confirmHold(hold.holdId, savedStudentId);
      setMyHolds((prev) =>
        prev.map((item) =>
          item.holdId === hold.holdId ? { ...item, status: 'CONFIRMED' } : item,
        ),
      );
      setSelectedHoldId(hold.holdId);
      setSuccessMessage(STRINGS.holdConfirmedSuccess);
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

  return (
    <div className="app-shell" data-testid="parent-portal-view">
      {/* --- Sidebar Navigation for Parent Portal --- */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo bg-indigo-gradient text-white">
            <Building size={22} />
          </div>
          {!isSidebarCollapsed && (
            <div className="brand-meta">
              <h2 className="brand-name">ST. XAVIER ACADEMY</h2>
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
              </strong>
            </div>
          </div>

          <div className="topbar-right">
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

            {savedStudentId && (
              <div className="student-top-pill">
                <span className="student-pill-label">Student ID:</span>
                <span className="student-pill-id mono">{savedStudentId}</span>
              </div>
            )}
          </div>
        </header>

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
                        {classes.map((cls) => {
                          const isApplyingThis = applyingClassId === cls.id;
                          const noStudent = !isValidStudentId(savedStudentId);
                          const noSeats = cls.availableSeats <= 0;
                          const existingActive = activeHoldByClassId.get(cls.id);
                          const alreadyWaitlisted = waitlistEntries.find((w) => w.classId === cls.id);

                          let disabledReason: string | null = null;
                          if (noStudent) {
                            disabledReason = STRINGS.applyDisabledNoStudent;
                          } else if (existingActive) {
                            disabledReason = STRINGS.applyDisabledAlreadyActive;
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
                                  className={`seat-counter ${
                                    cls.availableSeats > 0 ? 'seat-open' : 'seat-full'
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

                                    {noSeats && !noStudent && !existingActive && (
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
                        <div className="alert alert-success mt-3">
                          <CheckCircle2 size={18} />
                          <span>{STRINGS.confirmedNotice}</span>
                        </div>
                      )}

                      {effectiveStatus === 'CANCELLED' && (
                        <div className="alert alert-muted mt-3">
                          <span>{STRINGS.cancelledNotice}</span>
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
                              <strong>Sibling Currently Studying at St. Xavier Academy</strong> (Grants
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
                        {myHolds.map((hold) => {
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
        </div>
      </main>
    </div>
  );
}
