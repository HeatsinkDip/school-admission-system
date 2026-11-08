import React, { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from './api';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  ADMIN_USER_STORAGE_KEY,
  POLL_INTERVAL_MS,
} from './config';
import { STRINGS } from './strings';
import {
  AdminApplicationDetail,
  AdminApplicationSummary,
  AdminClassDetail,
  AdminDashboard,
  AdminSession,
  AuditLogEntry,
  PaymentRecord,
  WaitlistEntry,
} from './types';

interface AdminPortalProps {
  onNavigateToParent: () => void;
}

type AdminTab = 'dashboard' | 'applications' | 'classes' | 'finance' | 'settings';

export function AdminPortal({ onNavigateToParent }: AdminPortalProps) {
  // --- Persisted Admin Session ---
  const [session, setSession] = useState<AdminSession | null>(() => {
    try {
      const token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      const rawUser = localStorage.getItem(ADMIN_USER_STORAGE_KEY);
      if (token && rawUser) {
        return JSON.parse(rawUser) as AdminSession;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // --- Login Form State ---
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- Navigation & Feedback ---
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Admin Data ---
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [applications, setApplications] = useState<AdminApplicationSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminApplicationDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // --- Filters ---
  const [filterClassId, setFilterClassId] = useState('');
  const [filterHoldStatus, setFilterHoldStatus] = useState('');
  const [filterAppStatus, setFilterAppStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Create / Edit Class Form ---
  const [newClassName, setNewClassName] = useState('');
  const [newClassShift, setNewClassShift] = useState('Morning');
  const [newClassSeats, setNewClassSeats] = useState('120');
  const [newClassMinAge, setNewClassMinAge] = useState('10');
  const [newClassMaxAge, setNewClassMaxAge] = useState('13');
  const [newClassStatus, setNewClassStatus] = useState('OPEN');
  const [newAdmissionFee, setNewAdmissionFee] = useState('15000');
  const [newSessionCharge, setNewSessionCharge] = useState('8000');
  const [newDevelopmentFee, setNewDevelopmentFee] = useState('10000');
  const [newSecurityDeposit, setNewSecurityDeposit] = useState('5000');
  const [newFirstMonthTuition, setNewFirstMonthTuition] = useState('6000');
  const [newMonthlyTuition, setNewMonthlyTuition] = useState('6000');
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<AdminClassDetail | null>(null);

  // --- Review Form State ---
  const [reviewNote, setReviewNote] = useState('');
  const [assignedSection, setAssignedSection] = useState('Section A');
  const [enrolledStudentNo, setEnrolledStudentNo] = useState('');
  const [concessionPercentInput, setConcessionPercentInput] = useState('25');
  const [concessionNoteInput, setConcessionNoteInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // --- Settings Form State ---
  const [academicYearInput, setAcademicYearInput] = useState('2027');
  const [opensAtInput, setOpensAtInput] = useState('2026-01-01T00:00:00Z');
  const [closesAtInput, setClosesAtInput] = useState('2027-12-31T23:59:59Z');
  const [deadlineDaysInput, setDeadlineDaysInput] = useState('7');
  const [siblingDiscountInput, setSiblingDiscountInput] = useState('10');

  const showError = useCallback((err: unknown) => {
    setSuccessMessage(null);
    if (err instanceof ApiClientError) {
      if (err.status === 401) {
        setSession(null);
        try {
          localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
          localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      setErrorMessage(err.friendlyMessage);
    } else if (err instanceof Error && err.message) {
      setErrorMessage(err.message);
    } else {
      setErrorMessage(STRINGS.errors.UNKNOWN_ERROR);
    }
  }, []);

  const refreshAdminData = useCallback(
    async (silent = false) => {
      if (!session?.token) return;
      try {
        const [dash, apps, pays, waits, logs] = await Promise.all([
          api.getAdminDashboard(session.token),
          api.listAdminApplications(session.token, {
            classId: filterClassId || undefined,
            holdStatus: filterHoldStatus || undefined,
            applicationStatus: filterAppStatus || undefined,
            search: searchQuery || undefined,
          }),
          api.listAdminPayments(session.token),
          api.listAdminWaitlist(session.token),
          api.listAuditLogs(session.token),
        ]);
        setDashboard(dash);
        setApplications(apps);
        setPayments(pays);
        setWaitlist(waits);
        setAuditLogs(logs);

        if (!silent) {
          setAcademicYearInput(dash.settings.academicYear);
          setOpensAtInput(dash.settings.admissionOpensAt);
          setClosesAtInput(dash.settings.admissionClosesAt);
          setDeadlineDaysInput(String(dash.settings.paperworkDeadlineDays));
          setSiblingDiscountInput(String(dash.settings.siblingDiscountPercent));
        }
      } catch (err) {
        if (!silent) showError(err);
      }
    },
    [
      session?.token,
      filterClassId,
      filterHoldStatus,
      filterAppStatus,
      searchQuery,
      showError,
    ],
  );

  useEffect(() => {
    if (!session?.token) return;
    void refreshAdminData(false);
    const timer = window.setInterval(() => {
      void refreshAdminData(true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [session?.token, refreshAdminData]);

  const loadStudentDossier = async (studentId: string) => {
    if (!session?.token) return;
    setSelectedStudentId(studentId);
    try {
      const detail = await api.getAdminApplicationDetail(session.token, studentId);
      setSelectedDetail(detail);
      setReviewNote(detail.profile.reviewerNote || '');
      setAssignedSection(detail.profile.assignedSection || 'Section A');
      setEnrolledStudentNo(
        detail.profile.enrolledStudentNo || `STU-2027-${studentId.slice(-4)}`,
      );
      setConcessionPercentInput(String(detail.profile.concessionPercent || 25));
      setConcessionNoteInput(detail.profile.concessionNote || '');
    } catch (err) {
      showError(err);
    }
  };

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginPassword.trim()) {
      setErrorMessage('Please enter the admin password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await api.loginAdmin(loginUsername, loginPassword);
      setSession(result);
      setLoginPassword('');
      try {
        localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, result.token);
        localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(result));
      } catch {
        // ignore
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await api.logoutAdmin(session.token);
      } catch {
        // ignore
      }
    }
    setSession(null);
    setDashboard(null);
    try {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      localStorage.removeItem(ADMIN_USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleCreateOrUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = newClassName.trim();
    if (!trimmedName) {
      setErrorMessage(STRINGS.createClassNameError);
      return;
    }
    const parsedSeats = Number(newClassSeats);
    if (!Number.isInteger(parsedSeats) || parsedSeats <= 0) {
      setErrorMessage(STRINGS.createClassSeatsError);
      return;
    }

    setIsSavingClass(true);
    try {
      const payload = {
        name: trimmedName,
        shift: newClassShift,
        academicYear: academicYearInput || '2027',
        totalSeats: parsedSeats,
        minAge: newClassMinAge ? Number(newClassMinAge) : null,
        maxAge: newClassMaxAge ? Number(newClassMaxAge) : null,
        status: newClassStatus,
        admissionFee: Number(newAdmissionFee) || 15000,
        sessionCharge: Number(newSessionCharge) || 8000,
        developmentFee: Number(newDevelopmentFee) || 10000,
        securityDeposit: Number(newSecurityDeposit) || 5000,
        firstMonthTuition: Number(newFirstMonthTuition) || 6000,
        monthlyTuition: Number(newMonthlyTuition) || 6000,
      };

      if (editingClass) {
        const updated = await api.updateAdminClass(session.token, editingClass.id, payload);
        setSuccessMessage(
          `Updated "${updated.name}" (${updated.totalSeats} seats, status: ${updated.status}).`,
        );
        setEditingClass(null);
      } else {
        const created = await api.createAdminClass(session.token, payload);
        setSuccessMessage(STRINGS.createClassSuccess(created.name, created.totalSeats));
      }

      setNewClassName('');
      setNewClassSeats('120');
      await refreshAdminData(false);
    } catch (err) {
      showError(err);
    } finally {
      setIsSavingClass(false);
    }
  };

  const startEditClass = (cls: AdminClassDetail) => {
    setEditingClass(cls);
    setNewClassName(cls.name);
    setNewClassShift(cls.shift);
    setNewClassSeats(String(cls.totalSeats));
    setNewClassMinAge(cls.minAge != null ? String(cls.minAge) : '');
    setNewClassMaxAge(cls.maxAge != null ? String(cls.maxAge) : '');
    setNewClassStatus(cls.status);
    setNewAdmissionFee(String(cls.admissionFee));
    setNewSessionCharge(String(cls.sessionCharge));
    setNewDevelopmentFee(String(cls.developmentFee));
    setNewSecurityDeposit(String(cls.securityDeposit));
    setNewFirstMonthTuition(String(cls.firstMonthTuition));
    setNewMonthlyTuition(String(cls.monthlyTuition));
    setActiveTab('classes');
  };

  const handleReviewAction = async (
    action: 'UNDER_REVIEW' | 'APPROVE' | 'REQUEST_CORRECTION' | 'REJECT' | 'ENROLL',
  ) => {
    if (!session?.token || !selectedStudentId) return;
    setIsSubmittingReview(true);
    setErrorMessage(null);
    try {
      const updated = await api.reviewApplication(session.token, selectedStudentId, {
        action,
        note: reviewNote,
        assignedSection,
        enrolledStudentNo,
      });
      setSelectedDetail(updated);
      setSuccessMessage(`Application status updated to ${updated.profile.applicationStatus}.`);
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleVerifyDocument = async (
    type: string,
    status: 'APPROVED' | 'CORRECTION_NEEDED',
  ) => {
    if (!session?.token || !selectedStudentId) return;
    const comment =
      status === 'CORRECTION_NEEDED'
        ? reviewNote || 'Please re-upload a clear copy of this document.'
        : 'Verified by Admission Office';
    try {
      const updatedProfile = await api.verifyDocument(session.token, selectedStudentId, {
        type,
        status,
        comment,
      });
      setSelectedDetail((prev) => (prev ? { ...prev, profile: updatedProfile } : null));
      setSuccessMessage(`Document ${type} marked as ${status}.`);
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    }
  };

  const handleConcessionDecision = async (status: 'APPROVED' | 'DECLINED') => {
    if (!session?.token || !selectedStudentId) return;
    try {
      const updatedProfile = await api.reviewConcession(session.token, selectedStudentId, {
        status,
        percent: Number(concessionPercentInput) || 0,
        note: concessionNoteInput,
      });
      setSelectedDetail((prev) => (prev ? { ...prev, profile: updatedProfile } : null));
      setSuccessMessage(`Concession request marked as ${status}.`);
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    }
  };

  const handleIssueRefund = async (payment: PaymentRecord) => {
    if (!session?.token) return;
    try {
      await api.refundPayment(
        session.token,
        payment.id,
        payment.netAmount,
        'Refund approved by Finance Office',
      );
      setSuccessMessage(`Issued refund for receipt ${payment.receiptNo}.`);
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    try {
      await api.updateAdminSettings(session.token, {
        academicYear: academicYearInput,
        admissionOpensAt: opensAtInput,
        admissionClosesAt: closesAtInput,
        paperworkDeadlineDays: Number(deadlineDaysInput) || 7,
        siblingDiscountPercent: Number(siblingDiscountInput) || 10,
      });
      setSuccessMessage('Academic window and admission settings saved.');
      await refreshAdminData(false);
    } catch (err) {
      showError(err);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'HoldId',
      'StudentId',
      'StudentName',
      'FatherName',
      'FatherPhone',
      'ClassName',
      'Shift',
      'SeatStatus',
      'ReviewStatus',
      'ConcessionStatus',
      'ReceiptNo',
      'NetPaidBDT',
      'AssignedSection',
      'EnrolledRoll',
    ];
    const rows = applications.map((a) =>
      [
        a.holdId,
        a.studentId,
        `"${(a.fullNameEn || '').replace(/"/g, '""')}"`,
        `"${(a.fatherName || '').replace(/"/g, '""')}"`,
        a.fatherPhone,
        `"${a.className.replace(/"/g, '""')}"`,
        a.shift,
        a.holdStatus,
        a.applicationStatus,
        a.concessionStatus,
        a.receiptNo || '',
        a.netPaidAmount ?? 0,
        a.assignedSection || '',
        a.enrolledStudentNo || '',
      ].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admission-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // Render: Password-Secured Admin Login Gate (/admin)
  // =========================================================================

  if (!session) {
    return (
      <div className="container" data-testid="admin-login-screen">
        <header className="header header-row">
          <div>
            <h1>{STRINGS.adminPortalTitle}</h1>
            <p className="subtitle">{STRINGS.adminPortalSubtitle}</p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            data-testid="back-to-parent-btn"
            onClick={onNavigateToParent}
          >
            {STRINGS.navBackToParent}
          </button>
        </header>

        {errorMessage && (
          <div className="alert alert-error" role="alert" data-testid="error-banner">
            <span>{errorMessage}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setErrorMessage(null)}
            >
              ×
            </button>
          </div>
        )}

        <section className="card admin-login-card">
          <h2>Admin Portal Sign In</h2>
          <p className="hint-text">
            This area (/admin) is restricted to authorized school administration staff. Enter your
            staff role and password below to continue.
          </p>

          <form onSubmit={handleLogin} className="admin-login-form" noValidate>
            <div className="form-field">
              <label htmlFor="admin-username-select" className="form-label">
                Staff Account / Role
              </label>
              <select
                id="admin-username-select"
                data-testid="admin-username-select"
                className="input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              >
                <option value="admin">admin — Principal / Super Admin</option>
                <option value="officer">officer — Admission Officer</option>
                <option value="accountant">accountant — Finance / Accountant</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-password-input" className="form-label">
                Admin Password
              </label>
              <input
                id="admin-password-input"
                data-testid="admin-password-input"
                type="password"
                className="input"
                placeholder="Enter admin password (default: admin123)"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
              />
            </div>

            <div className="button-group">
              <button
                type="submit"
                className="btn btn-primary"
                data-testid="admin-login-btn"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Signing in...' : 'Sign In to Admin Console'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="quick-fill-admin-btn"
                onClick={() => {
                  setLoginUsername('admin');
                  setLoginPassword('admin123');
                }}
              >
                Fill Default (admin123)
              </button>
            </div>
          </form>

          <div className="credentials-box">
            <strong>Default Staff Credentials (Pre-seeded):</strong>
            <ul>
              <li>
                <strong>Super Admin:</strong> username <code>admin</code> / password{' '}
                <code>admin123</code>
              </li>
              <li>
                <strong>Admission Officer:</strong> username <code>officer</code> / password{' '}
                <code>officer123</code>
              </li>
              <li>
                <strong>Accountant:</strong> username <code>accountant</code> / password{' '}
                <code>accountant123</code>
              </li>
            </ul>
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // Render: Authenticated Admin Console
  // =========================================================================

  return (
    <div className="container" data-testid="admin-console-view">
      <header className="header header-row">
        <div>
          <h1>{STRINGS.adminPortalTitle}</h1>
          <p className="subtitle">
            Signed in as <strong>{session.fullName}</strong> (
            <span className="mono">{session.role}</span>)
          </p>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="btn btn-outline"
            data-testid="back-to-parent-btn"
            onClick={onNavigateToParent}
          >
            {STRINGS.navBackToParent}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            data-testid="admin-logout-btn"
            onClick={() => void handleLogout()}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* --- Alert Banners --- */}
      {errorMessage && (
        <div className="alert alert-error" role="alert" data-testid="error-banner">
          <span>{errorMessage}</span>
          <button type="button" className="alert-close" onClick={() => setErrorMessage(null)}>
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="status" data-testid="success-banner">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>
            ×
          </button>
        </div>
      )}

      {/* --- Admin Navigation Tabs --- */}
      <nav className="portal-tabs" aria-label="Admin Console Sections">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          data-testid="admin-tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
        >
          1. Live Seats & Dashboard
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
          data-testid="admin-tab-classes"
          onClick={() => setActiveTab('classes')}
        >
          2. Classes & Fee Builder
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
          data-testid="admin-tab-applications"
          onClick={() => setActiveTab('applications')}
        >
          3. Applications & Review Queue ({applications.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`}
          data-testid="admin-tab-finance"
          onClick={() => setActiveTab('finance')}
        >
          4. Payments, Refunds & Waitlist
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          data-testid="admin-tab-settings"
          onClick={() => setActiveTab('settings')}
        >
          5. Window Settings & Audit Log
        </button>
      </nav>

      {/* --- KPI Summary Strip --- */}
      {dashboard && (
        <section className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total Seats</span>
            <strong className="kpi-value">{dashboard.totalSeats}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Active Holds</span>
            <strong className="kpi-value kpi-amber">{dashboard.totalHeld}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Confirmed Seats</span>
            <strong className="kpi-value kpi-green">{dashboard.totalConfirmed}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Available Seats</span>
            <strong className="kpi-value">{dashboard.totalAvailable}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Net Revenue (BDT)</span>
            <strong className="kpi-value kpi-green">
              ৳{dashboard.totalRevenueBdt.toLocaleString()}
            </strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Pending Reviews / Concessions</span>
            <strong className="kpi-value">
              {dashboard.pendingReviews} / {dashboard.pendingConcessions}
            </strong>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB 1 & TAB 2: Create / Manage Classes & Live Seat Table            */}
      {/* =================================================================== */}
      {(activeTab === 'dashboard' || activeTab === 'classes') && (
        <>
          <section className="card" data-testid="create-class-section">
            <div className="section-header">
              <h2>
                {editingClass
                  ? `Edit Class-Shift & Fee Structure (${editingClass.id})`
                  : 'Create Class-Shift & Fee Structure'}
              </h2>
              {editingClass && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setEditingClass(null);
                    setNewClassName('');
                    setNewClassSeats('120');
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleCreateOrUpdateClass} className="form-grid-3" noValidate>
              <div className="form-field">
                <label htmlFor="class-name-input" className="form-label">
                  {STRINGS.classNameLabel}
                </label>
                <input
                  id="class-name-input"
                  data-testid="class-name-input"
                  type="text"
                  className="input"
                  placeholder={STRINGS.classNamePlaceholder}
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  disabled={isSavingClass}
                />
              </div>

              <div className="form-field">
                <label htmlFor="class-shift-select" className="form-label">
                  Shift
                </label>
                <select
                  id="class-shift-select"
                  className="input"
                  value={newClassShift}
                  onChange={(e) => setNewClassShift(e.target.value)}
                >
                  <option value="Morning">Morning Shift</option>
                  <option value="Day">Day Shift</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="total-seats-input" className="form-label">
                  {STRINGS.totalSeatsLabel}
                </label>
                <input
                  id="total-seats-input"
                  data-testid="total-seats-input"
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                  placeholder={STRINGS.totalSeatsPlaceholder}
                  value={newClassSeats}
                  onChange={(e) => setNewClassSeats(e.target.value)}
                  disabled={isSavingClass}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Status</label>
                <select
                  className="input"
                  value={newClassStatus}
                  onChange={(e) => setNewClassStatus(e.target.value)}
                >
                  <option value="OPEN">OPEN (Accepting Applications)</option>
                  <option value="CLOSED">CLOSED (Block New Holds)</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Admission Fee (BDT)</label>
                <input
                  type="number"
                  className="input"
                  value={newAdmissionFee}
                  onChange={(e) => setNewAdmissionFee(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Session Charge (BDT)</label>
                <input
                  type="number"
                  className="input"
                  value={newSessionCharge}
                  onChange={(e) => setNewSessionCharge(e.target.value)}
                />
              </div>

              {activeTab === 'classes' && (
                <>
                  <div className="form-field">
                    <label className="form-label">Development Fee (BDT)</label>
                    <input
                      type="number"
                      className="input"
                      value={newDevelopmentFee}
                      onChange={(e) => setNewDevelopmentFee(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Security Deposit (BDT, Refundable)</label>
                    <input
                      type="number"
                      className="input"
                      value={newSecurityDeposit}
                      onChange={(e) => setNewSecurityDeposit(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">1st Month Tuition (BDT)</label>
                    <input
                      type="number"
                      className="input"
                      value={newFirstMonthTuition}
                      onChange={(e) => setNewFirstMonthTuition(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  data-testid="create-class-btn"
                  disabled={isSavingClass}
                >
                  {isSavingClass
                    ? STRINGS.creatingClassButton
                    : editingClass
                      ? 'Save Class Changes'
                      : STRINGS.createClassButton}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Class-Shifts & Live Seat Utilization</h2>
              <span className="hint-text">Auto-refreshes every 4 seconds</span>
            </div>

            {!dashboard || dashboard.classes.length === 0 ? (
              <p className="empty-state">No classes created yet. Create one above.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table" data-testid="admin-classes-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Class / Shift</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Held</th>
                      <th>Confirmed</th>
                      <th>Available</th>
                      <th>Payable at Admission</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.classes.map((c) => (
                      <tr key={c.id}>
                        <td className="mono">{c.id}</td>
                        <td>
                          <strong>{c.name}</strong>{' '}
                          <span className="hint-text">({c.shift})</span>
                        </td>
                        <td>
                          <span className={`status-badge status-${c.status.toLowerCase()}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>{c.totalSeats}</td>
                        <td>{c.heldSeats}</td>
                        <td>{c.confirmedSeats}</td>
                        <td>
                          <span
                            className={
                              c.availableSeats > 0 ? 'seat-pill seat-open' : 'seat-pill seat-full'
                            }
                          >
                            {c.availableSeats}
                          </span>
                        </td>
                        <td className="mono">৳{c.payableAtAdmissionTotal.toLocaleString()}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEditClass(c)}
                          >
                            Edit Seats / Fees
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 3: Applications, Document Verification & Concession Queue       */}
      {/* =================================================================== */}
      {activeTab === 'applications' && (
        <section className="card">
          <div className="section-header">
            <h2>Applications, Document Verification & Concession Queue</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
              Export CSV Report
            </button>
          </div>

          <div className="filter-bar">
            <input
              type="text"
              className="input"
              placeholder="Search by Student Name, 17-digit Birth Reg No, or Hold ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="input"
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {dashboard?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filterHoldStatus}
              onChange={(e) => setFilterHoldStatus(e.target.value)}
            >
              <option value="">All Seat Statuses</option>
              <option value="HELD">HELD</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <select
              className="input"
              value={filterAppStatus}
              onChange={(e) => setFilterAppStatus(e.target.value)}
            >
              <option value="">All Review Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="NEEDS_CORRECTION">NEEDS_CORRECTION</option>
              <option value="APPROVED">APPROVED</option>
              <option value="ENROLLED">ENROLLED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {applications.length === 0 ? (
            <p className="empty-state">No applications match the current filters.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hold ID</th>
                    <th>Student ID (17-digit)</th>
                    <th>Child Name</th>
                    <th>Class</th>
                    <th>Seat Status</th>
                    <th>Review Status</th>
                    <th>Dossier</th>
                    <th>Concession</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.holdId}>
                      <td className="mono">{app.holdId}</td>
                      <td className="mono">{app.studentId}</td>
                      <td>
                        <strong>{app.fullNameEn || '— Not Filled Yet —'}</strong>
                        {app.fullNameBn && <div className="hint-text">{app.fullNameBn}</div>}
                      </td>
                      <td>{app.className}</td>
                      <td>
                        <span className={`status-badge status-${app.holdStatus.toLowerCase()}`}>
                          {app.holdStatus}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge">{app.applicationStatus}</span>
                      </td>
                      <td>{app.completenessPercent}%</td>
                      <td>
                        {app.concessionRequested ? (
                          <span className="status-badge">
                            {app.concessionStatus} ({app.concessionPercent}%)
                          </span>
                        ) : (
                          'No'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          data-testid={`inspect-student-${app.studentId}`}
                          onClick={() => void loadStudentDossier(app.studentId)}
                        >
                          Inspect & Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* --- Selected Student Dossier Inspector --- */}
          {selectedDetail && (
            <div className="dossier-panel" data-testid="admin-dossier-panel">
              <div className="section-header">
                <h3>
                  Student Dossier: {selectedDetail.profile.fullNameEn || selectedDetail.profile.studentId}{' '}
                  (<span className="mono">{selectedDetail.profile.studentId}</span>)
                </h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSelectedStudentId(null);
                    setSelectedDetail(null);
                  }}
                >
                  Close Dossier
                </button>
              </div>

              <div className="detail-grid">
                <div>
                  <strong>English Name:</strong> {selectedDetail.profile.fullNameEn || '—'}
                </div>
                <div>
                  <strong>Bangla Name:</strong> {selectedDetail.profile.fullNameBn || '—'}
                </div>
                <div>
                  <strong>DOB / Gender / Blood:</strong> {selectedDetail.profile.dob || '—'} /{' '}
                  {selectedDetail.profile.gender || '—'} /{' '}
                  {selectedDetail.profile.bloodGroup || '—'}
                </div>
                <div>
                  <strong>Father:</strong> {selectedDetail.profile.fatherName || '—'} (
                  {selectedDetail.profile.fatherPhone || '—'}) — NID:{' '}
                  {selectedDetail.profile.fatherNid || '—'}
                </div>
                <div>
                  <strong>Mother:</strong> {selectedDetail.profile.motherName || '—'} (
                  {selectedDetail.profile.motherPhone || '—'}) — NID:{' '}
                  {selectedDetail.profile.motherNid || '—'}
                </div>
                <div>
                  <strong>Present Address:</strong> {selectedDetail.profile.presentAddress || '—'}
                </div>
                <div>
                  <strong>Previous School:</strong> {selectedDetail.profile.previousSchool || '—'}{' '}
                  ({selectedDetail.profile.lastClassPassed || '—'}, Result:{' '}
                  {selectedDetail.profile.lastResult || '—'})
                </div>
                <div>
                  <strong>Sibling in School:</strong>{' '}
                  {selectedDetail.profile.hasSibling
                    ? `Yes — ${selectedDetail.profile.siblingName} (${selectedDetail.profile.siblingClass}, ID: ${selectedDetail.profile.siblingStudentId})`
                    : 'No'}
                </div>
                <div>
                  <strong>Household Monthly Income:</strong> ৳
                  {selectedDetail.profile.monthlyIncome.toLocaleString()} (
                  {selectedDetail.profile.incomeBracket || '—'}, Dependents:{' '}
                  {selectedDetail.profile.dependents})
                </div>
              </div>

              {/* Document Verification Queue */}
              <h4>Uploaded Documents Verification</h4>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>File Name</th>
                      <th>Status</th>
                      <th>Verify Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetail.profile.documents.map((doc) => (
                      <tr key={doc.type}>
                        <td>{doc.label}</td>
                        <td className="mono">{doc.fileName || 'Not uploaded yet'}</td>
                        <td>
                          <span className="status-badge">{doc.status}</span>
                        </td>
                        <td>
                          <div className="button-group">
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => void handleVerifyDocument(doc.type, 'APPROVED')}
                            >
                              Approve Doc
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                void handleVerifyDocument(doc.type, 'CORRECTION_NEEDED')
                              }
                            >
                              Request Correction
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Need-based Concession Review */}
              {selectedDetail.profile.concessionRequested && (
                <div className="concession-review-box">
                  <h4>Need-Based Tuition Scholarship / Concession Review</h4>
                  <p className="hint-text">
                    Status: <strong>{selectedDetail.profile.concessionStatus}</strong> (Applies to
                    future monthly tuition; never blocks seat reservation).
                  </p>
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label className="form-label">Tuition Discount %</label>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        className="input"
                        value={concessionPercentInput}
                        onChange={(e) => setConcessionPercentInput(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Concession Decision Note</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Reason / remarks"
                        value={concessionNoteInput}
                        onChange={(e) => setConcessionNoteInput(e.target.value)}
                      />
                    </div>
                    <div className="button-group">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => void handleConcessionDecision('APPROVED')}
                      >
                        Approve Concession
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleConcessionDecision('DECLINED')}
                      >
                        Decline Concession
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Admission Decision & Enrollment */}
              <h4>Admission Officer Decision & Section Enrollment</h4>
              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Reviewer Note / Correction Instructions</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter comment for parent..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Assigned Section (on Enrollment)</label>
                  <input
                    type="text"
                    className="input"
                    value={assignedSection}
                    onChange={(e) => setAssignedSection(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Student Roll / ID (on Enrollment)</label>
                  <input
                    type="text"
                    className="input mono"
                    value={enrolledStudentNo}
                    onChange={(e) => setEnrolledStudentNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="button-group" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmittingReview}
                  onClick={() => void handleReviewAction('UNDER_REVIEW')}
                >
                  Mark Under Review
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isSubmittingReview}
                  onClick={() => void handleReviewAction('REQUEST_CORRECTION')}
                >
                  Request Correction
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={isSubmittingReview}
                  onClick={() => void handleReviewAction('APPROVE')}
                >
                  Approve Application
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isSubmittingReview}
                  onClick={() => void handleReviewAction('ENROLL')}
                >
                  Enroll Student & Issue Letter
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={isSubmittingReview}
                  onClick={() => void handleReviewAction('REJECT')}
                >
                  Reject (Release Seat & Refund)
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB 4: Payments, Refunds & Waitlist                                 */}
      {/* =================================================================== */}
      {activeTab === 'finance' && (
        <>
          <section className="card">
            <h2>Admission Fee Payments & Refunds</h2>
            {payments.length === 0 ? (
              <p className="empty-state">No confirmed payments recorded yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Student ID</th>
                      <th>Class</th>
                      <th>Gross (BDT)</th>
                      <th>Discount</th>
                      <th>Net Paid</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.receiptNo}</td>
                        <td className="mono">{p.studentId}</td>
                        <td>{p.className}</td>
                        <td className="mono">৳{p.grossAmount.toLocaleString()}</td>
                        <td className="mono">
                          ৳{p.discountAmount.toLocaleString()}
                          {p.discountReason && (
                            <div className="hint-text">{p.discountReason}</div>
                          )}
                        </td>
                        <td className="mono">
                          <strong>৳{p.netAmount.toLocaleString()}</strong>
                        </td>
                        <td>
                          <span className="status-badge">{p.status}</span>
                        </td>
                        <td>
                          {p.status === 'SUCCESS' && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleIssueRefund(p)}
                            >
                              Issue Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Class Waitlist Queue</h2>
            {waitlist.length === 0 ? (
              <p className="empty-state">No students are currently on the waitlist.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Class</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Joined At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlist.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <strong>#{w.position}</strong>
                        </td>
                        <td>{w.className}</td>
                        <td className="mono">{w.studentId}</td>
                        <td>{w.studentName || '—'}</td>
                        <td className="mono">{w.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 5: Academic Window Settings & Audit Log                         */}
      {/* =================================================================== */}
      {activeTab === 'settings' && (
        <>
          <section className="card">
            <h2>Academic Year & Admission Window Settings</h2>
            <form onSubmit={handleSaveSettings} className="form-grid-3">
              <div className="form-field">
                <label className="form-label">Academic Year</label>
                <input
                  type="text"
                  className="input"
                  value={academicYearInput}
                  onChange={(e) => setAcademicYearInput(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Admission Opens At (UTC ISO)</label>
                <input
                  type="text"
                  className="input mono"
                  value={opensAtInput}
                  onChange={(e) => setOpensAtInput(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Admission Closes At (UTC ISO)</label>
                <input
                  type="text"
                  className="input mono"
                  value={closesAtInput}
                  onChange={(e) => setClosesAtInput(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Paperwork Deadline (Days after Payment)</label>
                <input
                  type="number"
                  className="input"
                  value={deadlineDaysInput}
                  onChange={(e) => setDeadlineDaysInput(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Automatic Sibling Discount (%)</label>
                <input
                  type="number"
                  className="input"
                  value={siblingDiscountInput}
                  onChange={(e) => setSiblingDiscountInput(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Save Settings
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Immutable Admin Audit Log</h2>
            {auditLogs.length === 0 ? (
              <p className="empty-state">No audit events recorded yet.</p>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Actor</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="mono">{log.createdAt}</td>
                        <td>
                          <strong>{log.actor}</strong>
                        </td>
                        <td className="mono">{log.role}</td>
                        <td className="mono">{log.action}</td>
                        <td className="mono">
                          {log.entity} ({log.entityId})
                        </td>
                        <td>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
