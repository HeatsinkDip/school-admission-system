import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ProfileSectionTab = 'student' | 'guardians' | 'finance' | 'documents';

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

  // --- Core Seat & Hold Data ---
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myHolds, setMyHolds] = useState<HoldItem[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);

  // --- Extended Parent Data (Child Profile, Fee Breakdown, Receipts, Waitlist) ---
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
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileSectionTab>('student');
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

  // --- Core Data Fetching ---
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
          // Optional extended endpoints; ignore in minimal mock environments
        }
      }
    },
    [savedStudentId, showError],
  );

  // Load Student Profile when Student ID changes
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

  // Focused application for the "Application View" panel
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
      // ignore storage errors
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

  // --- Child Information / Profile Handlers ---
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

  // --- Student Seat Actions ---
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

  // Map of classId -> active (HELD and unexpired, or CONFIRMED) hold for current student
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
    <div className="container" data-testid="parent-portal-view">
      <header className="header header-row">
        <div>
          <h1>{STRINGS.appTitle}</h1>
          <p className="subtitle">{STRINGS.appSubtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          data-testid="go-to-admin-btn"
          onClick={onNavigateToAdmin}
        >
          {STRINGS.navGoToAdmin}
        </button>
      </header>

      {/* --- Top Student ID Bar --- */}
      <section className="card student-bar" data-testid="student-id-section">
        {!isEditingStudentId && savedStudentId ? (
          <div className="student-active-bar">
            <div>
              <span className="student-badge-label">{STRINGS.applyingAsPrefix}</span>{' '}
              <strong data-testid="active-student-id" className="mono">
                {savedStudentId}
              </strong>
              {profile?.fullNameEn && (
                <span className="student-name-pill"> — {profile.fullNameEn}</span>
              )}
              {profile?.applicationStatus && (
                <span className="status-badge" style={{ marginLeft: '0.5rem' }}>
                  Dossier: {profile.applicationStatus}
                </span>
              )}
            </div>
            <div className="button-group">
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="change-student-id-btn"
                onClick={handleChangeStudentId}
              >
                {STRINGS.studentIdChangeButton}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                data-testid="clear-student-id-btn"
                onClick={handleClearStudentId}
              >
                {STRINGS.studentIdClearButton}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveStudentId} className="student-form" noValidate>
            <label htmlFor="student-id-input" className="form-label">
              {STRINGS.studentIdLabel}
            </label>
            <div className="input-row">
              <input
                id="student-id-input"
                data-testid="student-id-input"
                type="text"
                inputMode="numeric"
                maxLength={17}
                className="input mono"
                placeholder={STRINGS.studentIdPlaceholder}
                value={studentIdInput}
                onChange={(e) => {
                  setStudentIdInput(e.target.value);
                  if (studentIdError) setStudentIdError(null);
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
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
            {!savedStudentId && !studentIdError && (
              <p className="hint-text">{STRINGS.studentIdRequiredHint}</p>
            )}
          </form>
        )}
      </section>

      {/* --- Alert Banners --- */}
      {errorMessage && (
        <div className="alert alert-error" role="alert" data-testid="error-banner">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setErrorMessage(null)}
            aria-label={STRINGS.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="status" data-testid="success-banner">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label={STRINGS.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      {/* --- Enrollment Welcome Banner (if Enrolled by Admin) --- */}
      {profile?.applicationStatus === 'ENROLLED' && (
        <section className="card highlight-card" data-testid="enrollment-letter-card">
          <h2>Congratulations! Admission Approved & Enrolled</h2>
          <p>
            <strong>Student Name:</strong> {profile.fullNameEn} ({profile.studentId}) |{' '}
            <strong>Assigned Section:</strong> {profile.assignedSection || 'Section A'} |{' '}
            <strong>Student Roll No:</strong>{' '}
            <span className="mono">{profile.enrolledStudentNo}</span>
          </p>
          {profile.reviewerNote && <p className="hint-text">Note: {profile.reviewerNote}</p>}
        </section>
      )}

      {/* --- Officer Correction Request Alert --- */}
      {profile?.applicationStatus === 'NEEDS_CORRECTION' && (
        <div className="alert alert-error" role="alert">
          <span>
            <strong>Correction Requested by Admission Officer:</strong>{' '}
            {profile.reviewerNote ||
              'Please review and update your child profile or documents below and click Submit.'}
          </span>
        </div>
      )}

      {/* --- Child Information, Guardians, Financial & Documents Form --- */}
      <section className="card" data-testid="child-profile-section">
        <div className="section-header">
          <div>
            <h2>{STRINGS.childInfoTitle}</h2>
            <p className="hint-text">{STRINGS.childInfoSubtitle}</p>
          </div>
          {savedStudentId && (
            <div className="completeness-box">
              <span className="hint-text">
                {STRINGS.profileCompletenessLabel}:{' '}
                <strong>{profile?.completenessPercent ?? 0}%</strong>
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${profile?.completenessPercent ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {!savedStudentId ? (
          <p className="empty-state">{STRINGS.studentIdRequiredHint}</p>
        ) : (
          <>
            <div className="portal-tabs" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className={`tab-btn ${activeProfileTab === 'student' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('student')}
              >
                1. Student Profile
              </button>
              <button
                type="button"
                className={`tab-btn ${activeProfileTab === 'guardians' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('guardians')}
              >
                2. Father, Mother & Guardian
              </button>
              <button
                type="button"
                className={`tab-btn ${activeProfileTab === 'finance' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('finance')}
              >
                3. Income & Concession
              </button>
              <button
                type="button"
                className={`tab-btn ${activeProfileTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveProfileTab('documents')}
              >
                4. Document Upload
              </button>
            </div>

            {activeProfileTab === 'student' && (
              <div className="form-grid-3">
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
                    onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Gender</label>
                  <select
                    className="input"
                    value={profileForm.gender || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
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
                  <label className="form-label">Religion (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Islam / Hinduism / Christianity / Buddhism"
                    value={profileForm.religion || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, religion: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="child-present-address">
                    Present Address *
                  </label>
                  <input
                    id="child-present-address"
                    data-testid="child-address-input"
                    type="text"
                    className="input"
                    placeholder="House, Road, Area, City"
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
                    placeholder="Previous school name"
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
                    placeholder="e.g. Class 5 — GPA 5.00"
                    value={profileForm.lastResult || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, lastResult: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Health Notes / Allergies / Special Needs</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="None, or specify medical notes"
                    value={profileForm.healthNotes || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, healthNotes: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      data-testid="sibling-checkbox"
                      checked={Boolean(profileForm.hasSibling)}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, hasSibling: e.target.checked })
                      }
                    />{' '}
                    Sibling Currently Studying Here (10% Admission Fee Discount)
                  </label>
                  {profileForm.hasSibling && (
                    <input
                      type="text"
                      className="input"
                      placeholder="Sibling Name, Class & Roll No"
                      value={profileForm.siblingName || ''}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, siblingName: e.target.value })
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {activeProfileTab === 'guardians' && (
              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Father’s Full Name *</label>
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
                  <label className="form-label">Father’s NID Number</label>
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
                  <label className="form-label">Father’s Mobile Number *</label>
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
                  <label className="form-label">Father’s Occupation & Employer</label>
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
                  <label className="form-label">Mother’s Full Name *</label>
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
                  <label className="form-label">Mother’s NID Number</label>
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
                  <label className="form-label">Mother’s Mobile Number</label>
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
                  <label className="form-label">Mother’s Occupation</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Occupation"
                    value={profileForm.motherOccupation || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, motherOccupation: e.target.value })
                    }
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Emergency Contact Phone</label>
                  <input
                    type="text"
                    className="input mono"
                    placeholder="Emergency contact number"
                    value={profileForm.emergencyContact || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, emergencyContact: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {activeProfileTab === 'finance' && (
              <div className="form-grid-3">
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
                  <label className="form-label">Number of Household Dependents</label>
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
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={Boolean(profileForm.concessionRequested)}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          concessionRequested: e.target.checked,
                        })
                      }
                    />{' '}
                    Apply for Need-Based Monthly Tuition Scholarship / Concession (Reviewed after
                    seat confirmation; never delays first-come, first-served seat booking)
                  </label>
                  {profile?.concessionRequested && (
                    <p className="hint-text">
                      Concession Review Status: <strong>{profile.concessionStatus}</strong>
                      {profile.concessionPercent > 0 &&
                        ` (${profile.concessionPercent}% approved off monthly tuition)`}
                      {profile.concessionNote && ` — ${profile.concessionNote}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeProfileTab === 'documents' && (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Required Document</th>
                      <th>Uploaded File</th>
                      <th>Verification Status</th>
                      <th>Upload / Attach</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile?.documents || []).map((doc) => (
                      <tr key={doc.type}>
                        <td>
                          <strong>{doc.label}</strong>
                          {doc.reviewerComment && (
                            <div className="field-error">{doc.reviewerComment}</div>
                          )}
                        </td>
                        <td className="mono">{doc.fileName || 'Not uploaded'}</td>
                        <td>
                          <span className="status-badge">{doc.status}</span>
                        </td>
                        <td>
                          <div className="button-group">
                            <input
                              type="file"
                              aria-label={`Upload ${doc.label}`}
                              onChange={(e) =>
                                void handleUploadDocument(
                                  doc.type,
                                  doc.label,
                                  e.target.files?.[0] || null,
                                )
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
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

            <div className="button-group" style={{ marginTop: '1rem' }}>
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
      </section>

      {/* --- Class List --- */}
      <section className="card" data-testid="class-list-section">
        <div className="section-header">
          <h2>{STRINGS.classesSectionTitle}</h2>
          <span className="hint-text">{STRINGS.classesAutoRefreshNote}</span>
        </div>

        {classes.length === 0 ? (
          <p className="empty-state" data-testid="no-classes-message">
            {STRINGS.noClassesYet}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table" data-testid="classes-table">
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
                      <td data-testid={`class-held-${cls.id}`}>{cls.heldSeats}</td>
                      <td data-testid={`class-confirmed-${cls.id}`}>{cls.confirmedSeats}</td>
                      <td data-testid={`class-available-${cls.id}`}>
                        <span
                          className={
                            cls.availableSeats > 0 ? 'seat-pill seat-open' : 'seat-pill seat-full'
                          }
                        >
                          {cls.availableSeats}
                        </span>
                      </td>
                      <td>
                        <div className="action-cell">
                          <div className="button-group">
                            <button
                              type="button"
                              className="btn btn-primary"
                              data-testid={`apply-btn-${cls.id}`}
                              disabled={isDisabled}
                              onClick={() => void handleApply(cls)}
                            >
                              {isApplyingThis ? STRINGS.applyingButton : STRINGS.applyButton}
                            </button>
                            {noSeats && !noStudent && !existingActive && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                data-testid={`waitlist-btn-${cls.id}`}
                                disabled={
                                  joiningWaitlistClassId === cls.id || Boolean(alreadyWaitlisted)
                                }
                                onClick={() => void handleJoinWaitlist(cls)}
                              >
                                {alreadyWaitlisted
                                  ? `Waitlisted (#${alreadyWaitlisted.position})`
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
      </section>

      {/* --- Active / Focused Application View + Fee Breakdown --- */}
      {savedStudentId && focusedHold && (
        <section className="card highlight-card" data-testid="active-application-section">
          <h2>{STRINGS.activeApplicationTitle}</h2>
          {(() => {
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
              <div className="application-detail" data-testid="focused-hold-card">
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">{STRINGS.classLabel}:</span>{' '}
                    <strong>
                      {focusedHold.className ||
                        classNamesById.get(focusedHold.classId) ||
                        focusedHold.classId}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.holdIdLabel}:</span>{' '}
                    <span className="mono">{focusedHold.holdId}</span>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.statusLabel}:</span>{' '}
                    <span
                      className={`status-badge status-${effectiveStatus.toLowerCase()}`}
                      data-testid="focused-hold-status"
                    >
                      {effectiveStatus}
                    </span>{' '}
                    <span className="hint-text">({formatStatusLabel(effectiveStatus)})</span>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.timeRemainingLabel}:</span>{' '}
                    {effectiveStatus === 'HELD' ? (
                      <strong className="countdown mono" data-testid="focused-hold-countdown">
                        {formatRemainingSeconds(remainingSec)}
                      </strong>
                    ) : (
                      <span className="mono" data-testid="focused-hold-countdown">
                        00:00
                      </span>
                    )}
                  </div>
                </div>

                {/* Itemized Fee Breakdown Table */}
                {focusedFeeBreakdown && (
                  <div className="fee-breakdown-box" data-testid="fee-breakdown-section">
                    <h4>Admission Fee Breakdown (BDT)</h4>
                    <div className="fee-summary-row">
                      <span>Gross Payable at Confirmation:</span>
                      <strong className="mono">
                        ৳{focusedFeeBreakdown.grossPayableAtAdmission.toLocaleString()}
                      </strong>
                    </div>
                    {focusedFeeBreakdown.siblingDiscountAmount > 0 && (
                      <div className="fee-summary-row fee-discount">
                        <span>{focusedFeeBreakdown.discountReason}:</span>
                        <strong className="mono">
                          -৳{focusedFeeBreakdown.siblingDiscountAmount.toLocaleString()}
                        </strong>
                      </div>
                    )}
                    <div className="fee-summary-row fee-net">
                      <span>Total Payable Now to Confirm Seat:</span>
                      <strong className="mono">
                        ৳{focusedFeeBreakdown.netPayableAtAdmission.toLocaleString()} BDT
                      </strong>
                    </div>
                  </div>
                )}

                {effectiveStatus === 'EXPIRED' && (
                  <p className="status-note expired-note" data-testid="focused-expired-notice">
                    {STRINGS.expiredNotice}
                  </p>
                )}
                {effectiveStatus === 'CONFIRMED' && (
                  <p className="status-note confirmed-note">{STRINGS.confirmedNotice}</p>
                )}
                {effectiveStatus === 'CANCELLED' && (
                  <p className="status-note">{STRINGS.cancelledNotice}</p>
                )}

                <div className="button-group">
                  <button
                    type="button"
                    className="btn btn-success"
                    data-testid="focused-pay-btn"
                    disabled={!canPay}
                    onClick={() => void handleConfirmHold(focusedHold)}
                  >
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
          })()}
        </section>
      )}

      {/* --- My Applications & Payment Receipts List --- */}
      <section className="card" data-testid="my-applications-section">
        <h2>{STRINGS.myApplicationsTitle}</h2>
        {!savedStudentId ? (
          <p className="empty-state">{STRINGS.studentIdRequiredHint}</p>
        ) : myHolds.length === 0 ? (
          <p className="empty-state" data-testid="no-applications-message">
            {STRINGS.noApplicationsYet}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table" data-testid="my-holds-table">
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
                      onClick={() => setSelectedHoldId(hold.holdId)}
                    >
                      <td className="mono">{hold.holdId}</td>
                      <td>
                        {hold.className || classNamesById.get(hold.classId) || hold.classId}
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${effectiveStatus.toLowerCase()}`}
                          data-testid={`hold-status-${hold.holdId}`}
                        >
                          {effectiveStatus}
                        </span>
                      </td>
                      <td className="mono" data-testid={`hold-countdown-${hold.holdId}`}>
                        {effectiveStatus === 'HELD'
                          ? formatRemainingSeconds(remainingSec)
                          : '00:00'}
                      </td>
                      <td>
                        <div className="button-group">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
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
                            className="btn btn-danger btn-sm"
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

        {/* Official Payment Receipts */}
        {payments.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <h3>Official Payment Receipts</h3>
            <div className="table-wrapper">
              <table className="table" data-testid="parent-receipts-table">
                <thead>
                  <tr>
                    <th>Receipt No</th>
                    <th>Class</th>
                    <th>Gross Fee</th>
                    <th>Concession Discount</th>
                    <th>Net Paid (BDT)</th>
                    <th>Status</th>
                    <th>Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">
                        <strong>{p.receiptNo}</strong>
                      </td>
                      <td>{p.className}</td>
                      <td className="mono">৳{p.grossAmount.toLocaleString()}</td>
                      <td className="mono">৳{p.discountAmount.toLocaleString()}</td>
                      <td className="mono">
                        <strong>৳{p.netAmount.toLocaleString()}</strong>
                      </td>
                      <td>
                        <span className="status-badge">{p.status}</span>
                      </td>
                      <td className="mono">{p.paidAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
