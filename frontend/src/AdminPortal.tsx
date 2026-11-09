import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  GraduationCap,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  ArrowLeft,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Eye,
  RefreshCw,
  PlusCircle,
  TrendingUp,
  Download,
  KeyRound,
  Building,
  UserX,
  BadgeCheck,
  Menu,
  ChevronRight,
  Bell,
  Radio,
  Megaphone,
  Send,
  CheckCheck,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  api,
  ApiClientError,
  broadcastAdminNotification,
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from './api';
import {
  ADMIN_TOKEN_STORAGE_KEY,
  ADMIN_USER_STORAGE_KEY,
  POLL_INTERVAL_MS,
} from './config';
import { ApplicationInspectionModal } from './ApplicationInspectionModal';
import { ClassRoutineView } from './ClassRoutineView';
import { DocumentViewerModal } from './DocumentViewerModal';
import { NotificationCenter } from './NotificationCenter';
import { Pagination } from './Pagination';
import { STRINGS } from './strings';
import { notifyToast, ToastContainer } from './ToastContainer';
import {
  AdminApplicationDetail,
  AdminApplicationSummary,
  AdminClassDetail,
  AdminDashboard,
  AdminSession,
  AppNotification,
  AuditLogEntry,
  ClassRoutine,
  DocumentItem,
  PaymentRecord,
  WaitlistEntry,
} from './types';
import { fetchAllRoutines } from './api';

interface AdminPortalProps {
  onNavigateToParent: () => void;
}

type AdminView =
  | 'overview'
  | 'applications'
  | 'doc_verification'
  | 'classes'
  | 'routines'
  | 'finance'
  | 'refunds'
  | 'waitlist'
  | 'alerts'
  | 'settings'
  | 'audit';

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

  // --- Navigation & Layout State ---
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Admin Data State ---
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [applications, setApplications] = useState<AdminApplicationSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminApplicationDetail | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // --- Active Document Viewer Modal ---
  const [inspectingDoc, setInspectingDoc] = useState<{
    doc: DocumentItem;
    profile: AdminApplicationDetail['profile'];
  } | null>(null);

  // --- Filter State ---
  const [filterClassId, setFilterClassId] = useState('');
  const [filterHoldStatus, setFilterHoldStatus] = useState('');
  const [filterAppStatus, setFilterAppStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Class Create / Edit State ---
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

  // --- Inspection Modal State ---
  const [inspectingApp, setInspectingApp] = useState<AdminApplicationSummary | null>(null);
  const [inspectingDetail, setInspectingDetail] = useState<AdminApplicationDetail | null>(null);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);

  // --- Routine State ---
  const [routines, setRoutines] = useState<ClassRoutine[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<ClassRoutine | null>(null);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(false);

  // --- Pagination States ---
  const [appPage, setAppPage] = useState(1);
  const [classPage, setClassPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [waitlistPage, setWaitlistPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const PAGE_SIZE = 10;

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

  // --- Live Notifications & Alerts State ---
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [alertFilterCategory, setAlertFilterCategory] = useState<string>('ALL');

  // --- Broadcast Announcement Form State ---
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'INFO' | 'WARNING' | 'DANGER' | 'SUCCESS'>('INFO');
  const [broadcastCategory, setBroadcastCategory] = useState('SYSTEM');
  const [broadcastRecipientType, setBroadcastRecipientType] = useState('ALL');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleMarkAdminNotificationRead = async (id: number) => {
    if (!session) return;
    await markAdminNotificationRead(id, session.token);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadNotifCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAdminNotificationsRead = async () => {
    if (!session) return;
    await markAllAdminNotificationsRead(session.token);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotifCount(0);
    notifyToast('Alerts Cleared', 'All admin alerts marked as read', 'info');
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setErrorMessage('Please enter both an alert title and message.');
      return;
    }
    setIsBroadcasting(true);
    setErrorMessage(null);
    try {
      const created = await broadcastAdminNotification(session.token, {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        severity: broadcastSeverity,
        category: broadcastCategory,
        recipientType: broadcastRecipientType,
      });
      setNotifications((prev) => [created, ...prev]);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setSuccessMessage('Alert announcement broadcasted across the school portal!');
      notifyToast('Alert Broadcasted', `Sent alert: "${created.title}"`, 'success');
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // --- Role Helpers ---
  const currentRole = session?.role || 'SUPER_ADMIN';
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const isAdmissionOfficer = currentRole === 'ADMISSION_OFFICER';
  const isAccountant = currentRole === 'ACCOUNTANT';

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
        const [dash, apps, pays, waits, logs, notifs] = await Promise.all([
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
          fetchAdminNotifications(session.token),
        ]);
        setDashboard(dash);
        setApplications(apps);
        setPayments(pays);
        setWaitlist(waits);
        setAuditLogs(logs);
        if (notifs && Array.isArray(notifs.notifications)) {
          setNotifications(notifs.notifications);
          setUnreadNotifCount(notifs.unreadCount);
        }

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

  // Set default view based on role upon login
  useEffect(() => {
    if (!session) return;
    if (session.role === 'ADMISSION_OFFICER') {
      setActiveView('applications');
    } else if (session.role === 'ACCOUNTANT') {
      setActiveView('finance');
    } else {
      setActiveView('overview');
    }
  }, [session?.role]);

  const loadStudentDossier = async (studentId: string) => {
    if (!session?.token) return;
    setSelectedStudentId(studentId);
    try {
      const detail = await api.getAdminApplicationDetail(session.token, studentId);
      setSelectedDetail(detail);
      setInspectingDetail(detail);
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

  const openInspectionModal = async (app: AdminApplicationSummary) => {
    setInspectingApp(app);
    setInspectingDetail(null);
    setIsLoadingInspection(true);
    try {
      await loadStudentDossier(app.studentId);
    } finally {
      setIsLoadingInspection(false);
    }
  };

  const loadAllRoutines = async () => {
    setIsLoadingRoutines(true);
    try {
      const r = await fetchAllRoutines();
      setRoutines(r);
      if (r.length > 0 && !selectedRoutine) {
        setSelectedRoutine(r[0]);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoadingRoutines(false);
    }
  };

  useEffect(() => {
    if (activeView === 'routines') {
      void loadAllRoutines();
    }
  }, [activeView]);

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

  // Role simulation switcher (convenient for test verification)
  const handleSwitchRoleSimulation = async (roleUsername: string, pass: string) => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await api.loginAdmin(roleUsername, pass);
      setSession(result);
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(ADMIN_USER_STORAGE_KEY, JSON.stringify(result));
      setSuccessMessage(`Switched active view to ${result.fullName} (${result.role}).`);
    } catch (err) {
      showError(err);
    } finally {
      setIsLoggingIn(false);
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
        notifyToast('Class Updated', `Updated "${updated.name}" with ${updated.totalSeats} seats.`, 'info');
        setEditingClass(null);
      } else {
        const created = await api.createAdminClass(session.token, payload);
        setSuccessMessage(STRINGS.createClassSuccess(created.name, created.totalSeats));
        notifyToast('Class Created', `Created "${created.name}" with ${created.totalSeats} seats.`, 'success');
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
    setActiveView('classes');
  };

  const handleDeleteClass = async (cls: AdminClassDetail) => {
    if (!session?.token) return;
    if (cls.confirmedSeats > 0) {
      alert(`Cannot delete '${cls.name}' because it already has ${cls.confirmedSeats} confirmed student admission(s). Please set its status to CLOSED instead.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete class '${cls.name}' (${cls.id})?`)) {
      return;
    }
    try {
      await api.deleteClass(cls.id, session.token);
      setDashboard((prev) =>
        prev ? { ...prev, classes: prev.classes.filter((c) => c.id !== cls.id) } : null,
      );
      setSuccessMessage(`Class '${cls.name}' was deleted.`);
      notifyToast('Class Deleted', `Class '${cls.name}' permanently removed.`, 'warning');
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteApplication = async (studentId: string) => {
    if (!session?.token) return;
    if (!window.confirm(`Are you sure you want to delete application records for student ${studentId}?`)) {
      return;
    }
    try {
      await api.deleteApplication(studentId, session.token);
      setApplications((prev) => prev.filter((a) => a.studentId !== studentId));
      if (selectedStudentId === studentId) {
        setSelectedStudentId(null);
        setSelectedDetail(null);
      }
      setSuccessMessage(`Application for ${studentId} deleted.`);
      notifyToast('Application Deleted', `Application record for ${studentId} removed.`, 'warning');
      await refreshAdminData(true);
    } catch (err) {
      showError(err);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    if (!session?.token) return;
    try {
      await api.deleteNotification(id, session.token);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notifyToast('Alert Deleted', 'Notification removed from live feed.', 'info');
    } catch (err) {
      showError(err);
    }
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
      notifyToast('Application Decision', `Student ${selectedStudentId} marked as ${updated.profile.applicationStatus}.`, 'success');
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
    customComment?: string,
  ) => {
    if (!session?.token || !selectedStudentId) return;
    const comment = customComment ||
      (status === 'CORRECTION_NEEDED'
        ? reviewNote || 'Please re-upload a clear copy of this document.'
        : 'Verified by Admission Office');
    try {
      const updatedProfile = await api.verifyDocument(session.token, selectedStudentId, {
        type,
        status,
        comment,
      });
      setSelectedDetail((prev) => (prev ? { ...prev, profile: updatedProfile } : null));
      setSuccessMessage(`Document ${type} marked as ${status}.`);
      notifyToast('Document Verified', `Document ${type} marked as ${status}.`, 'info');
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
      notifyToast('Concession Reviewed', `Concession marked as ${status}.`, 'info');
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
      notifyToast('Refund Issued', `Refund for receipt ${payment.receiptNo} completed.`, 'warning');
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
      notifyToast('Settings Saved', 'Academic admission window saved.', 'success');
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
  // 1. Password-Secured Staff Login Gateway
  // =========================================================================

  if (!session) {
    return (
      <div className="login-gateway-page" data-testid="admin-login-screen">
        <div className="login-gateway-box">
          <div className="login-card-header">
            <div className="school-emblem">
              <Shield size={32} />
            </div>
            <h2>Staff Portal Authentication</h2>
            <p className="login-desc">
              Restricted portal for authorized School Administration, Admission Officers, and Finance Staff.
            </p>
          </div>

          {errorMessage && (
            <div className="alert alert-error" role="alert" data-testid="error-banner">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form-body" noValidate>
            <div className="form-field">
              <label htmlFor="admin-username-select" className="form-label">
                Select Staff Role / Account
              </label>
              <select
                id="admin-username-select"
                data-testid="admin-username-select"
                className="input select-lg"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              >
                <option value="admin">Principal / Super Admin (Full System Access)</option>
                <option value="officer">Senior Admission Officer (Admissions & Documents)</option>
                <option value="accountant">Chief Finance Officer (Billing & Refunds)</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-password-input" className="form-label">
                Security Password
              </label>
              <div className="input-with-icon">
                <KeyRound size={18} className="input-icon" />
                <input
                  id="admin-password-input"
                  data-testid="admin-password-input"
                  type="password"
                  className="input pl-10"
                  placeholder="Enter staff security password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="quick-fill-presets">
              <span className="preset-label">1-Click Quick Fill Credentials:</span>
              <div className="button-group">
                <button
                  type="button"
                  className="preset-btn"
                  data-testid="quick-fill-admin-btn"
                  onClick={() => {
                    setLoginUsername('admin');
                    setLoginPassword('admin123');
                  }}
                >
                  Principal (admin123)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setLoginUsername('officer');
                    setLoginPassword('officer123');
                  }}
                >
                  Admission Officer (officer123)
                </button>
                <button
                  type="button"
                  className="preset-btn"
                  onClick={() => {
                    setLoginUsername('accountant');
                    setLoginPassword('accountant123');
                  }}
                >
                  Finance Officer (accountant123)
                </button>
              </div>
            </div>

            <div className="login-actions">
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                data-testid="admin-login-btn"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Authenticating Security Session...' : 'Sign In to Staff Console'}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-full"
                data-testid="back-to-parent-btn"
                onClick={onNavigateToParent}
              >
                <ArrowLeft size={16} /> Return to Parent Portal
              </button>
            </div>
          </form>

          <div className="login-footer-security">
            <BadgeCheck size={16} className="text-emerald" />
            <span>Encrypted Session • Role-Based Access Control • Immutable Audit</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. Authenticated Admin Dashboard & Officer Workspaces
  // =========================================================================

  return (
    <div className="app-shell" data-testid="admin-console-view">
      {/* --- Sidebar Navigation --- */}
      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Building size={22} />
          </div>
          {!isSidebarCollapsed && (
            <div className="brand-meta">
              <h2 className="brand-name">ONNOROKOM PROJUKTI SCHOOL</h2>
              <span className="brand-badge">ADMIN CONSOLE</span>
            </div>
          )}
        </div>

        {/* User Identity & Role Badge */}
        <div className="sidebar-user-card">
          <div className="user-avatar-circle">
            {isSuperAdmin ? 'SA' : isAdmissionOfficer ? 'AO' : 'FO'}
          </div>
          {!isSidebarCollapsed && (
            <div className="user-details">
              <div className="user-name">{session.fullName}</div>
              <div className={`role-badge role-${session.role.toLowerCase()}`}>
                {isSuperAdmin
                  ? 'SUPER ADMIN'
                  : isAdmissionOfficer
                  ? 'ADMISSION OFFICER'
                  : 'FINANCE OFFICER'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu by Role */}
        <nav className="sidebar-nav">
          {/* Universal Overview */}
          <button
            type="button"
            className={`nav-item ${activeView === 'overview' ? 'active' : ''}`}
            data-testid="admin-tab-dashboard"
            onClick={() => setActiveView('overview')}
            title="Live Capacity & Overview"
          >
            <LayoutDashboard size={19} />
            {!isSidebarCollapsed && <span>Live Seats & Stats</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === 'alerts' ? 'active' : ''}`}
            data-testid="admin-tab-alerts"
            onClick={() => setActiveView('alerts')}
            title="Real-Time Alerts & User Activity Stream"
          >
            <Bell size={19} />
            {!isSidebarCollapsed && <span>Alerts & Live Feed</span>}
            {!isSidebarCollapsed && unreadNotifCount > 0 && (
              <span className="nav-badge-alert">{unreadNotifCount}</span>
            )}
          </button>

          {/* Admission Officer / Super Admin sections */}
          {(isSuperAdmin || isAdmissionOfficer) && (
            <>
              <div className="nav-group-label">{!isSidebarCollapsed && 'ADMISSIONS WORKSPACE'}</div>
              <button
                type="button"
                className={`nav-item ${activeView === 'applications' ? 'active' : ''}`}
                data-testid="admin-tab-applications"
                onClick={() => setActiveView('applications')}
                title="Applications Review Queue"
              >
                <Users size={19} />
                {!isSidebarCollapsed && <span>Applications Queue</span>}
                {!isSidebarCollapsed && applications.length > 0 && (
                  <span className="nav-badge">{applications.length}</span>
                )}
              </button>

              <button
                type="button"
                className={`nav-item ${activeView === 'doc_verification' ? 'active' : ''}`}
                onClick={() => setActiveView('doc_verification')}
                title="Document Verification Desk"
              >
                <FileCheck2 size={19} />
                {!isSidebarCollapsed && <span>Document Verification</span>}
              </button>

              <button
                type="button"
                className={`nav-item ${activeView === 'waitlist' ? 'active' : ''}`}
                onClick={() => setActiveView('waitlist')}
                title="Waitlist Management"
              >
                <Clock size={19} />
                {!isSidebarCollapsed && <span>Waitlist Queue</span>}
                {!isSidebarCollapsed && waitlist.length > 0 && (
                  <span className="nav-badge">{waitlist.length}</span>
                )}
              </button>
            </>
          )}

          {/* Finance Officer / Super Admin sections */}
          {(isSuperAdmin || isAccountant) && (
            <>
              <div className="nav-group-label">{!isSidebarCollapsed && 'FINANCE & BILLING'}</div>
              <button
                type="button"
                className={`nav-item ${activeView === 'finance' ? 'active' : ''}`}
                data-testid="admin-tab-finance"
                onClick={() => setActiveView('finance')}
                title="Payments & Revenue Collections"
              >
                <DollarSign size={19} />
                {!isSidebarCollapsed && <span>Payments & Collections</span>}
              </button>

              <button
                type="button"
                className={`nav-item ${activeView === 'refunds' ? 'active' : ''}`}
                onClick={() => setActiveView('refunds')}
                title="Refunds Desk"
              >
                <CreditCard size={19} />
                {!isSidebarCollapsed && <span>Refunds Processing</span>}
              </button>
            </>
          )}

          {/* Classes & Fee Builder (Super Admin or viewable) */}
          <div className="nav-group-label">{!isSidebarCollapsed && 'ACADEMICS & SYSTEM'}</div>
          <button
            type="button"
            className={`nav-item ${activeView === 'classes' ? 'active' : ''}`}
            data-testid="admin-tab-classes"
            onClick={() => setActiveView('classes')}
            title="Class-Shifts & Fee Structures"
          >
            <GraduationCap size={19} />
            {!isSidebarCollapsed && <span>Classes & Fee Builder</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeView === 'routines' ? 'active' : ''}`}
            data-testid="admin-tab-routines"
            onClick={() => setActiveView('routines')}
            title="Class Timetables & Fixed Operating Hours"
          >
            <Clock size={19} />
            {!isSidebarCollapsed && <span>Class Routines & Hours</span>}
          </button>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
                data-testid="admin-tab-settings"
                onClick={() => setActiveView('settings')}
                title="Academic Window & System Settings"
              >
                <Settings size={19} />
                {!isSidebarCollapsed && <span>Window & Rules</span>}
              </button>

              <button
                type="button"
                className={`nav-item ${activeView === 'audit' ? 'active' : ''}`}
                onClick={() => setActiveView('audit')}
                title="Immutable Audit Log"
              >
                <Shield size={19} />
                {!isSidebarCollapsed && <span>Audit Trail</span>}
              </button>
            </>
          )}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          {/* Quick Role Tester Switcher */}
          {!isSidebarCollapsed && (
            <div className="role-simulator-widget">
              <span className="sim-label">Simulate Officer View:</span>
              <div className="sim-buttons">
                <button
                  type="button"
                  className={`sim-btn ${isSuperAdmin ? 'active' : ''}`}
                  onClick={() => void handleSwitchRoleSimulation('admin', 'admin123')}
                  title="Switch to Super Admin"
                >
                  Principal
                </button>
                <button
                  type="button"
                  className={`sim-btn ${isAdmissionOfficer ? 'active' : ''}`}
                  onClick={() => void handleSwitchRoleSimulation('officer', 'officer123')}
                  title="Switch to Admission Officer"
                >
                  Admissions
                </button>
                <button
                  type="button"
                  className={`sim-btn ${isAccountant ? 'active' : ''}`}
                  onClick={() => void handleSwitchRoleSimulation('accountant', 'accountant123')}
                  title="Switch to Finance Officer"
                >
                  Finance
                </button>
              </div>
            </div>
          )}

          <div className="sidebar-action-links">
            <button
              type="button"
              className="sidebar-link-btn"
              data-testid="back-to-parent-btn"
              onClick={onNavigateToParent}
            >
              <ArrowLeft size={16} />
              {!isSidebarCollapsed && <span>Parent Portal</span>}
            </button>

            <button
              type="button"
              className="sidebar-link-btn text-rose"
              data-testid="admin-logout-btn"
              onClick={() => void handleLogout()}
            >
              <LogOut size={16} />
              {!isSidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
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
              <span>Admin Console</span>
              <ChevronRight size={14} className="crumb-sep" />
              <strong className="crumb-current">
                {activeView === 'overview' && 'Live Seats & Performance'}
                {activeView === 'alerts' && 'Live Activity & Urgent Alert Center'}
                {activeView === 'applications' && 'Admission Applications Queue'}
                {activeView === 'doc_verification' && 'Document Verification Desk'}
                {activeView === 'classes' && 'Class-Shifts & Fee Structures'}
                {activeView === 'finance' && 'Finance & Collections Log'}
                {activeView === 'refunds' && 'Refunds Processing Desk'}
                {activeView === 'waitlist' && 'Class Waitlist Queue'}
                {activeView === 'settings' && 'Admission Window & Settings'}
                {activeView === 'audit' && 'Immutable Audit Trail'}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="sync-status-indicator" title="Connected to PostgreSQL Database">
              <span className="pulse-dot" />
              <span className="sync-text">PostgreSQL Active</span>
            </div>

            <button
              type="button"
              className="btn-icon"
              onClick={() => void refreshAdminData(false)}
              title="Refresh Data"
            >
              <RefreshCw size={17} />
            </button>

            <NotificationCenter
              unreadCount={unreadNotifCount}
              notifications={notifications}
              onMarkRead={handleMarkAdminNotificationRead}
              onMarkAllRead={handleMarkAllAdminNotificationsRead}
              onRefresh={() => void refreshAdminData(true)}
              titleLabel="School System & Officer Alerts"
            />

            <div className="topbar-user-pill">
              <span className="user-role-tag">{session.role}</span>
              <span className="user-display-name">{session.fullName}</span>
            </div>
          </div>
        </header>

        {/* Global Alert Banners */}
        {errorMessage && (
          <div className="alert alert-error" role="alert" data-testid="error-banner">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
            <button
              type="button"
              className="alert-close"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss error"
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
              aria-label="Dismiss success"
            >
              ×
            </button>
          </div>
        )}

        <div className="content-container">
          {/* ================================================================= */}
          {/* VIEW: OVERVIEW & LIVE SEAT DASHBOARD                              */}
          {/* ================================================================= */}
          {activeView === 'overview' && dashboard && (
            <div className="view-section">
              {/* Metric Stat Cards */}
              <div className="kpi-grid-modern">
                <div className="kpi-stat-card">
                  <div className="kpi-icon-box bg-blue-subtle text-blue">
                    <GraduationCap size={22} />
                  </div>
                  <div className="kpi-stat-body">
                    <span className="kpi-caption">Total Seat Capacity</span>
                    <strong className="kpi-number">{dashboard.totalSeats}</strong>
                    <span className="kpi-subtext">Across all class-shifts</span>
                  </div>
                </div>

                <div className="kpi-stat-card">
                  <div className="kpi-icon-box bg-amber-subtle text-amber">
                    <Clock size={22} />
                  </div>
                  <div className="kpi-stat-body">
                    <span className="kpi-caption">Active Temporary Holds</span>
                    <strong className="kpi-number text-amber">{dashboard.totalHeld}</strong>
                    <span className="kpi-subtext">Expiring in 600s fast-lane</span>
                  </div>
                </div>

                <div className="kpi-stat-card">
                  <div className="kpi-icon-box bg-emerald-subtle text-emerald">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="kpi-stat-body">
                    <span className="kpi-caption">Confirmed Admissions</span>
                    <strong className="kpi-number text-emerald">{dashboard.totalConfirmed}</strong>
                    <span className="kpi-subtext">Fee paid & confirmed</span>
                  </div>
                </div>

                <div className="kpi-stat-card">
                  <div className="kpi-icon-box bg-indigo-subtle text-indigo">
                    <TrendingUp size={22} />
                  </div>
                  <div className="kpi-stat-body">
                    <span className="kpi-caption">Net Collections</span>
                    <strong className="kpi-number text-indigo">৳{dashboard.totalRevenueBdt.toLocaleString()}</strong>
                    <span className="kpi-subtext">BDT via Simulated Gateway</span>
                  </div>
                </div>
              </div>

              {/* Class-Shift Live Utilization Table */}
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Class-Shifts & Live Seat Pools</h3>
                    <p className="panel-subtitle">
                      Zero over-selling guarantee enforced in PostgreSQL via row locks and DB clock.
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setActiveView('classes')}
                    >
                      <PlusCircle size={15} /> Add New Class-Shift
                    </button>
                  )}
                </div>

                <div className="table-responsive">
                  <table className="table-modern" data-testid="admin-classes-table">
                    <thead>
                      <tr>
                        <th>Class / Shift ID</th>
                        <th>Class & Shift Name</th>
                        <th>Academic Year</th>
                        <th>Status</th>
                        <th>Total Seats</th>
                        <th>Active Holds</th>
                        <th>Confirmed Seats</th>
                        <th>Available Seats</th>
                        <th>Payable at Admission</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.classes
                        .slice((classPage - 1) * PAGE_SIZE, classPage * PAGE_SIZE)
                        .map((cls) => (
                        <tr key={cls.id}>
                          <td className="mono font-semibold">{cls.id}</td>
                          <td>
                            <strong>{cls.name}</strong>{' '}
                            <span className="badge-shift">{cls.shift}</span>
                          </td>
                          <td className="mono">{cls.academicYear}</td>
                          <td>
                            <span className={`status-pill status-${cls.status.toLowerCase()}`}>
                              {cls.status}
                            </span>
                          </td>
                          <td className="font-semibold">{cls.totalSeats}</td>
                          <td className="text-amber font-semibold">{cls.heldSeats}</td>
                          <td className="text-emerald font-semibold">{cls.confirmedSeats}</td>
                          <td>
                            <span
                              className={`seat-counter ${
                                cls.availableSeats > 0 ? 'seat-open' : 'seat-full'
                              }`}
                            >
                              {cls.availableSeats} Left
                            </span>
                          </td>
                          <td className="mono font-semibold">৳{cls.payableAtAdmissionTotal.toLocaleString()}</td>
                          <td>
                            <div className="button-group">
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() => startEditClass(cls)}
                                title="Edit class and fee configuration"
                              >
                                <Edit2 size={12} className="inline mr-1" />
                                Edit
                              </button>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-xs"
                                  onClick={() => void handleDeleteClass(cls)}
                                  title="Permanently delete class"
                                >
                                  <Trash2 size={12} className="inline mr-1" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={classPage}
                  totalItems={dashboard.classes.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setClassPage}
                  itemLabel="classes"
                />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: APPLICATION REVIEW QUEUE & DOSSIER INSPECTOR               */}
          {/* ================================================================= */}
          {(activeView === 'applications' || activeView === 'doc_verification') && (
            <div className="view-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">
                      {isAdmissionOfficer
                        ? 'Admission Officer — Applications & Document Verification'
                        : 'Application Dossier Verification Queue'}
                    </h3>
                    <p className="panel-subtitle">
                      Verify child profile details, inspect uploaded certificates, recommend concessions, and assign student rolls.
                    </p>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleExportCsv}>
                    <Download size={15} /> Export CSV Roster
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="search-filter-grid">
                  <div className="search-box">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      className="input input-search"
                      placeholder="Search by 17-digit ID, child name, or hold ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="input select-filter"
                    value={filterClassId}
                    onChange={(e) => setFilterClassId(e.target.value)}
                  >
                    <option value="">All Class-Shifts</option>
                    {dashboard?.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.shift})
                      </option>
                    ))}
                  </select>

                  <select
                    className="input select-filter"
                    value={filterHoldStatus}
                    onChange={(e) => setFilterHoldStatus(e.target.value)}
                  >
                    <option value="">All Seat Statuses</option>
                    <option value="HELD">HELD (Reserved)</option>
                    <option value="CONFIRMED">CONFIRMED (Paid)</option>
                    <option value="EXPIRED">EXPIRED (Released)</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>

                  <select
                    className="input select-filter"
                    value={filterAppStatus}
                    onChange={(e) => setFilterAppStatus(e.target.value)}
                  >
                    <option value="">All Verification Statuses</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                    <option value="NEEDS_CORRECTION">NEEDS_CORRECTION</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="ENROLLED">ENROLLED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                {/* Applications Table */}
                {applications.length === 0 ? (
                  <div className="empty-state-modern">
                    <Users size={48} className="empty-icon" />
                    <h4>No Applications Found</h4>
                    <p>No student applications match the specified criteria.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Hold ID</th>
                          <th>Birth Reg No (17-digit)</th>
                          <th>Child Full Name</th>
                          <th>Class & Shift</th>
                          <th>Seat Status</th>
                          <th>Dossier Review</th>
                          <th>Dossier Completeness</th>
                          <th>Receipt / Paid</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications
                          .slice((appPage - 1) * PAGE_SIZE, appPage * PAGE_SIZE)
                          .map((app) => (
                          <tr
                            key={app.holdId}
                            className={selectedStudentId === app.studentId ? 'row-selected' : ''}
                          >
                            <td className="mono font-semibold">{app.holdId}</td>
                            <td className="mono">{app.studentId}</td>
                            <td>
                              <strong>{app.fullNameEn || '— Incomplete —'}</strong>
                              {app.fullNameBn && <div className="text-muted text-xs">{app.fullNameBn}</div>}
                            </td>
                            <td>
                              {app.className} <span className="badge-shift">{app.shift}</span>
                            </td>
                            <td>
                              <span className={`status-pill status-${app.holdStatus.toLowerCase()}`}>
                                {app.holdStatus}
                              </span>
                            </td>
                            <td>
                              <span className={`status-pill status-review-${app.applicationStatus.toLowerCase()}`}>
                                {app.applicationStatus}
                              </span>
                            </td>
                            <td>
                              <div className="progress-compact">
                                <div
                                  className="progress-fill"
                                  style={{ width: `${app.completenessPercent}%` }}
                                />
                                <span className="text-xs">{app.completenessPercent}%</span>
                              </div>
                            </td>
                            <td className="mono text-xs">
                              {app.receiptNo ? (
                                <span className="text-emerald font-semibold">
                                  {app.receiptNo} (৳{app.netPaidAmount?.toLocaleString()})
                                </span>
                              ) : (
                                <span className="text-muted">Unpaid</span>
                              )}
                            </td>
                            <td>
                              <div className="button-group">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  data-testid={`inspect-student-${app.studentId}`}
                                  onClick={() => void openInspectionModal(app)}
                                >
                                  <Eye size={13} /> Inspect & Verify
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-xs"
                                    onClick={() => void handleDeleteApplication(app.studentId)}
                                    title="Delete student application record"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={appPage}
                  totalItems={applications.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setAppPage}
                  itemLabel="applications"
                />
              </div>

              {/* Selected Student Dossier Inspector Panel */}
              {selectedDetail && (
                <div className="panel-card dossier-inspector" data-testid="admin-dossier-panel">
                  <div className="dossier-header">
                    <div>
                      <div className="dossier-badge-row">
                        <span className="badge-student-id mono">{selectedDetail.profile.studentId}</span>
                        <span className={`status-pill status-review-${selectedDetail.profile.applicationStatus.toLowerCase()}`}>
                          Status: {selectedDetail.profile.applicationStatus}
                        </span>
                        {selectedDetail.profile.concessionRequested && (
                          <span className="badge-concession">
                            Need-Based Concession: {selectedDetail.profile.concessionStatus}
                          </span>
                        )}
                      </div>
                      <h3 className="dossier-title">
                        {selectedDetail.profile.fullNameEn || 'Unnamed Student'}{' '}
                        {selectedDetail.profile.fullNameBn && `(${selectedDetail.profile.fullNameBn})`}
                      </h3>
                    </div>
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

                  <div className="dossier-grid">
                    {/* Column 1: Student & Guardian Profile */}
                    <div className="dossier-card">
                      <h4 className="dossier-card-title">
                        <Users size={16} /> Student & Guardian Record
                      </h4>
                      <dl className="property-list">
                        <div className="prop-row">
                          <dt>Date of Birth:</dt>
                          <dd className="font-semibold">{selectedDetail.profile.dob || '—'}</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Gender / Blood Group:</dt>
                          <dd>{selectedDetail.profile.gender || '—'} / {selectedDetail.profile.bloodGroup || '—'}</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Father&apos;s Name & NID:</dt>
                          <dd>{selectedDetail.profile.fatherName || '—'} (NID: {selectedDetail.profile.fatherNid || '—'})</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Father Phone:</dt>
                          <dd className="mono">{selectedDetail.profile.fatherPhone || '—'}</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Mother&apos;s Name & NID:</dt>
                          <dd>{selectedDetail.profile.motherName || '—'} (NID: {selectedDetail.profile.motherNid || '—'})</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Present Address:</dt>
                          <dd>{selectedDetail.profile.presentAddress || '—'}</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Previous School / Result:</dt>
                          <dd>{selectedDetail.profile.previousSchool || '—'} ({selectedDetail.profile.lastResult || '—'})</dd>
                        </div>
                        <div className="prop-row">
                          <dt>Sibling Studying Here:</dt>
                          <dd>
                            {selectedDetail.profile.hasSibling ? (
                              <span className="text-emerald font-semibold">
                                Yes: {selectedDetail.profile.siblingName} ({selectedDetail.profile.siblingClass})
                              </span>
                            ) : (
                              'No'
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Column 2: Document Verification Table */}
                    <div className="dossier-card">
                      <div className="card-header-flex">
                        <h4 className="dossier-card-title">
                          <FileCheck2 size={16} /> Document Verification Desk
                        </h4>
                        <span className="doc-count-badge">
                          {selectedDetail.profile.documents.filter((d) => d.status === 'APPROVED').length} of {selectedDetail.profile.documents.length} Approved
                        </span>
                      </div>

                      <div className="table-responsive">
                        <table className="table-mini">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>File Uploaded</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetail.profile.documents.map((doc) => (
                              <tr key={doc.type}>
                                <td>
                                  <strong>{doc.label}</strong>
                                  {doc.reviewerComment && (
                                    <div className="text-rose text-xs mt-1">Note: {doc.reviewerComment}</div>
                                  )}
                                </td>
                                <td className="mono text-xs">{doc.fileName || 'Not uploaded'}</td>
                                <td>
                                  <span className={`status-pill status-${doc.status.toLowerCase()}`}>
                                    {doc.status}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    onClick={() =>
                                      setInspectingDoc({
                                        doc,
                                        profile: selectedDetail.profile,
                                      })
                                    }
                                  >
                                    <Eye size={12} /> Inspect & Verify
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Concession Recommendation */}
                      {selectedDetail.profile.concessionRequested && (
                        <div className="concession-box-modern">
                          <div className="flex-between">
                            <strong>Need-Based Tuition Concession Review</strong>
                            <span className="status-pill status-amber">
                              {selectedDetail.profile.concessionStatus}
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            Declared Monthly Income: ৳{selectedDetail.profile.monthlyIncome.toLocaleString()} BDT ({selectedDetail.profile.incomeBracket})
                          </p>
                          <div className="input-group-inline mt-2">
                            <input
                              type="number"
                              min={5}
                              max={100}
                              className="input input-sm w-24"
                              placeholder="Discount %"
                              value={concessionPercentInput}
                              onChange={(e) => setConcessionPercentInput(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-success btn-xs"
                              onClick={() => void handleConcessionDecision('APPROVED')}
                            >
                              Approve Concession
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              onClick={() => void handleConcessionDecision('DECLINED')}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Officer Final Decision Actions */}
                  <div className="officer-decision-bar">
                    <div className="decision-inputs">
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder="Officer remarks / instructions for parents..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                      <input
                        type="text"
                        className="input input-sm w-36"
                        placeholder="Section (e.g. A)"
                        value={assignedSection}
                        onChange={(e) => setAssignedSection(e.target.value)}
                      />
                      <input
                        type="text"
                        className="input input-sm w-44 mono"
                        placeholder="Student Roll No"
                        value={enrolledStudentNo}
                        onChange={(e) => setEnrolledStudentNo(e.target.value)}
                      />
                    </div>

                    <div className="decision-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('UNDER_REVIEW')}
                      >
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        className="btn btn-amber btn-sm"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('REQUEST_CORRECTION')}
                      >
                        Request Document Correction
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('APPROVE')}
                      >
                        Approve Dossier
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('ENROLL')}
                      >
                        <UserCheck size={14} /> Finalize Enrollment
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('REJECT')}
                      >
                        <UserX size={14} /> Reject Application
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: FINANCE & COLLECTIONS                                       */}
          {/* ================================================================= */}
          {(activeView === 'finance' || activeView === 'refunds') && (
            <div className="view-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">
                      {isAccountant ? 'Finance Officer — Collections & Refunds Desk' : 'Admission Payments & Invoices'}
                    </h3>
                    <p className="panel-subtitle">
                      Reconcile payments received, download audit-ready receipts, and process refunds.
                    </p>
                  </div>
                </div>

                {payments.length === 0 ? (
                  <div className="empty-state-modern">
                    <DollarSign size={48} className="empty-icon" />
                    <h4>No Payments Recorded</h4>
                    <p>When guardians confirm their seat holds, payment records appear here in real-time.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Receipt No</th>
                          <th>Student Registration No</th>
                          <th>Class-Shift</th>
                          <th>Gross Total</th>
                          <th>Concession Discount</th>
                          <th>Net Paid (BDT)</th>
                          <th>Gateway / Status</th>
                          <th>Paid Timestamp</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments
                          .slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE)
                          .map((p) => (
                          <tr key={p.id}>
                            <td className="mono font-semibold">{p.receiptNo}</td>
                            <td className="mono">{p.studentId}</td>
                            <td>{p.className}</td>
                            <td className="mono">৳{p.grossAmount.toLocaleString()}</td>
                            <td className="mono text-emerald">
                              {p.discountAmount > 0 ? `-৳${p.discountAmount.toLocaleString()}` : '—'}
                              {p.discountReason && <div className="text-xs text-muted">{p.discountReason}</div>}
                            </td>
                            <td className="mono font-semibold">৳{p.netAmount.toLocaleString()}</td>
                            <td>
                              <span className={`status-pill status-${p.status.toLowerCase()}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="mono text-xs">{new Date(p.paidAt).toLocaleString()}</td>
                            <td>
                              {p.status === 'SUCCESS' && (isSuperAdmin || isAccountant) && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-xs"
                                  onClick={() => void handleIssueRefund(p)}
                                >
                                  Issue Full Refund
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={paymentPage}
                  totalItems={payments.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPaymentPage}
                  itemLabel="payments"
                />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: CLASSES & FEE BUILDER                                       */}
          {/* ================================================================= */}
          {activeView === 'classes' && (
            <div className="view-section">
              {/* Class Creation / Modification Form */}
              <div className="panel-card" data-testid="create-class-section">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">
                      {editingClass ? `Edit Class-Shift (${editingClass.id})` : 'Class-Shift & Fee Structure Builder'}
                    </h3>
                    <p className="panel-subtitle">
                      Configure capacity, admission fee, session charge, and monthly tuition.
                    </p>
                  </div>
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

                <form onSubmit={handleCreateOrUpdateClass} className="form-modern-grid" noValidate>
                  <div className="form-field">
                    <label htmlFor="class-name-input" className="form-label">
                      {STRINGS.classNameLabel} *
                    </label>
                    <input
                      id="class-name-input"
                      data-testid="class-name-input"
                      type="text"
                      className="input"
                      placeholder="e.g. Class 6 - Morning Shift"
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
                      {STRINGS.totalSeatsLabel} *
                    </label>
                    <input
                      id="total-seats-input"
                      data-testid="total-seats-input"
                      type="number"
                      min={1}
                      step={1}
                      className="input"
                      placeholder="e.g. 120"
                      value={newClassSeats}
                      onChange={(e) => setNewClassSeats(e.target.value)}
                      disabled={isSavingClass}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Admission Status</label>
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
                    <label className="form-label">Security Deposit (Refundable)</label>
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

                  <div className="form-field">
                    <label className="form-label">Monthly Tuition (Month 2+)</label>
                    <input
                      type="number"
                      className="input"
                      value={newMonthlyTuition}
                      onChange={(e) => setNewMonthlyTuition(e.target.value)}
                    />
                  </div>

                  <div className="form-actions-full">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      data-testid="create-class-btn"
                      disabled={isSavingClass}
                    >
                      {isSavingClass
                        ? STRINGS.creatingClassButton
                        : editingClass
                        ? 'Save Class Configuration'
                        : STRINGS.createClassButton}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: WAITLIST QUEUE                                              */}
          {/* ================================================================= */}
          {activeView === 'waitlist' && (
            <div className="view-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Class Waitlist Queue</h3>
                    <p className="panel-subtitle">
                      Ordered first-come, first-served queue for students applying to fully occupied classes.
                    </p>
                  </div>
                </div>

                {waitlist.length === 0 ? (
                  <div className="empty-state-modern">
                    <Clock size={48} className="empty-icon" />
                    <h4>Waitlist Empty</h4>
                    <p>No applicants currently waiting in queue.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Queue Position</th>
                          <th>Class-Shift</th>
                          <th>Student Registration ID</th>
                          <th>Child Name</th>
                          <th>Joined Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitlist
                          .slice((waitlistPage - 1) * PAGE_SIZE, waitlistPage * PAGE_SIZE)
                          .map((w) => (
                          <tr key={w.id}>
                            <td>
                              <span className="badge-position">#{w.position}</span>
                            </td>
                            <td>{w.className}</td>
                            <td className="mono">{w.studentId}</td>
                            <td>{w.studentName || '—'}</td>
                            <td className="mono text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={waitlistPage}
                  totalItems={waitlist.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setWaitlistPage}
                  itemLabel="waitlist entries"
                />
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: CLASS ROUTINES & FIXED OPERATING HOURS                      */}
          {/* ================================================================= */}
          {activeView === 'routines' && (
            <div className="view-section" data-testid="admin-routines-view">
              <div className="panel-card mb-4">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title flex items-center gap-2">
                      <Clock className="text-indigo-600" size={20} />
                      Class Routines & Fixed Operating Hours
                    </h3>
                    <p className="panel-subtitle">
                      Inspect weekly timetable schedules, period breakdowns, teacher assignments, and classroom allocations.
                    </p>
                  </div>
                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm flex items-center gap-1.5"
                      onClick={() => void loadAllRoutines()}
                      disabled={isLoadingRoutines}
                    >
                      <RefreshCw size={14} className={isLoadingRoutines ? 'animate-spin' : ''} />
                      <span>Refresh Routines</span>
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
                  <p>No class routines available yet. Create classes first to initialize default shift schedules.</p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: ACADEMIC WINDOW & SETTINGS                                  */}
          {/* ================================================================= */}
          {activeView === 'settings' && isSuperAdmin && (
            <div className="view-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Academic Year & Admission Window Policy</h3>
                    <p className="panel-subtitle">Global settings governing hold deadlines and automatic concession rules.</p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="form-modern-grid">
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
                    <label className="form-label">Admission Opens (UTC ISO)</label>
                    <input
                      type="text"
                      className="input mono"
                      value={opensAtInput}
                      onChange={(e) => setOpensAtInput(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Admission Closes (UTC ISO)</label>
                    <input
                      type="text"
                      className="input mono"
                      value={closesAtInput}
                      onChange={(e) => setClosesAtInput(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Paperwork Deadline (Days)</label>
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

                  <div className="form-actions-full">
                    <button type="submit" className="btn btn-primary">
                      Save Window Configuration
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: ALERTS & LIVE ACTIVITY FEED                                 */}
          {/* ================================================================= */}
          {activeView === 'alerts' && (
            <div className="view-section" data-testid="admin-alerts-feed-view">
              {/* Broadcast Urgent Notice Tool */}
              <div className="panel-card mb-4 highlight-border">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title flex items-center gap-2">
                      <Radio className="text-rose-500 animate-pulse" size={20} />
                      Live Activity Stream & Urgent Alert Dispatch
                    </h3>
                    <p className="panel-subtitle">
                      Broadcast urgent announcements across the platform or stream real-time events triggered by parents and staff.
                    </p>
                  </div>
                  <div className="panel-actions">
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleMarkAllAdminNotificationsRead}
                      >
                        <CheckCheck size={16} /> Mark All Read
                      </button>
                    )}
                  </div>
                </div>

                <form className="broadcast-box mt-3" onSubmit={handleBroadcastAlert}>
                  <div className="broadcast-header">
                    <Megaphone size={16} className="text-amber-500" />
                    <span className="font-semibold text-sm">Dispatch School Notice / Alert Broadcast</span>
                  </div>
                  <div className="broadcast-inputs grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                    <input
                      type="text"
                      className="form-input col-span-2"
                      placeholder="Notice Title (e.g. Admission Morning Shift 95% Filled)"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      required
                    />
                    <select
                      className="form-select"
                      value={broadcastCategory}
                      onChange={(e) => setBroadcastCategory(e.target.value)}
                    >
                      <option value="SYSTEM">System Announcement</option>
                      <option value="SEAT_HOLD">Seat Hold Alert</option>
                      <option value="PAYMENT">Payment Alert</option>
                      <option value="DOCUMENT">Document Verification</option>
                      <option value="REVIEW">Admission Review</option>
                      <option value="REFUND">Refund Notice</option>
                    </select>
                    <select
                      className="form-select"
                      value={broadcastSeverity}
                      onChange={(e) => setBroadcastSeverity(e.target.value as any)}
                    >
                      <option value="INFO">Information (Blue)</option>
                      <option value="SUCCESS">Success Notice (Green)</option>
                      <option value="WARNING">Important Warning (Amber)</option>
                      <option value="DANGER">Urgent Alert (Red)</option>
                    </select>
                    <select
                      className="form-select"
                      value={broadcastRecipientType}
                      onChange={(e) => setBroadcastRecipientType(e.target.value)}
                    >
                      <option value="ALL">All Users (Parents + Staff)</option>
                      <option value="ALL_ADMINS">Staff Only</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder="Detailed alert announcement or instructions..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                      disabled={isBroadcasting}
                    >
                      <Send size={14} />
                      {isBroadcasting ? 'Sending...' : 'Broadcast Alert'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Activity Stream Feed */}
              <div className="panel-card">
                <div className="panel-header border-b pb-3 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                    <div className="notif-filter-bar mb-0">
                      {['ALL', 'SEAT_HOLD', 'PAYMENT', 'DOCUMENT', 'REVIEW', 'REFUND', 'SYSTEM'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`notif-filter-btn ${alertFilterCategory === cat ? 'active' : ''}`}
                          onClick={() => setAlertFilterCategory(cat)}
                        >
                          {cat === 'ALL' ? 'All Activity' : cat.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        className="form-input text-xs py-1.5 pl-8"
                        placeholder="Search alerts or Student ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Notifications List */}
                {notifications.filter((n) => {
                  if (alertFilterCategory !== 'ALL' && n.category !== alertFilterCategory) return false;
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const matchTitle = n.title?.toLowerCase().includes(q);
                    const matchMsg = n.message?.toLowerCase().includes(q);
                    const matchActor = n.actor?.toLowerCase().includes(q);
                    const matchStudent = n.recipientId?.toLowerCase().includes(q);
                    if (!matchTitle && !matchMsg && !matchActor && !matchStudent) return false;
                  }
                  return true;
                }).length === 0 ? (
                  <div className="notif-empty-state py-8">
                    <Bell size={36} className="text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No activity matching filter</p>
                    <span className="text-xs text-slate-500">Live events will stream here automatically as actions occur.</span>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {notifications.filter((n) => {
                      if (alertFilterCategory !== 'ALL' && n.category !== alertFilterCategory) return false;
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase();
                        const matchTitle = n.title?.toLowerCase().includes(q);
                        const matchMsg = n.message?.toLowerCase().includes(q);
                        const matchActor = n.actor?.toLowerCase().includes(q);
                        const matchStudent = n.recipientId?.toLowerCase().includes(q);
                        if (!matchTitle && !matchMsg && !matchActor && !matchStudent) return false;
                      }
                      return true;
                    }).map((notif) => (
                      <div
                        key={notif.id}
                        className={`timeline-item ${notif.isRead ? 'read' : 'unread'}`}
                        onClick={() => {
                          if (!notif.isRead) void handleMarkAdminNotificationRead(notif.id);
                        }}
                      >
                        <div className="timeline-marker">
                          <span className={`marker-dot severity-${notif.severity?.toLowerCase()}`} />
                        </div>
                        <div className="timeline-card">
                          <div className="timeline-header">
                            <div className="flex items-center gap-2">
                              <span className={`status-pill status-${notif.severity?.toLowerCase()}`}>
                                {notif.category?.replace('_', ' ')}
                              </span>
                              <strong className="timeline-title">{notif.title}</strong>
                            </div>
                            <span className="timeline-time mono text-xs text-slate-400">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <p className="timeline-msg">{notif.message}</p>
                          <div className="timeline-footer">
                            <span className="text-xs text-slate-500">Actor: <strong>{notif.actor}</strong></span>
                            {notif.recipientId && (
                              <span className="text-xs text-indigo-600 font-mono">Student: {notif.recipientId}</span>
                            )}
                            <div className="ml-auto flex items-center gap-1.5">
                              {!notif.isRead && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkAdminNotificationRead(notif.id);
                                  }}
                                >
                                  Mark Read
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs text-rose-600 hover:bg-rose-50"
                                  title="Delete alert from feed"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeleteNotification(notif.id);
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: IMMUTABLE AUDIT TRAIL                                       */}
          {/* ================================================================= */}
          {activeView === 'audit' && isSuperAdmin && (
            <div className="view-section">
              <div className="panel-card">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Immutable System & Staff Audit Trail</h3>
                    <p className="panel-subtitle">Every administrative decision, verification action, and payment update is recorded.</p>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <p className="empty-state">No audit events recorded yet.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Timestamp (UTC)</th>
                          <th>Staff Actor</th>
                          <th>Role</th>
                          <th>Action</th>
                          <th>Entity Ref</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs
                          .slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE)
                          .map((log) => (
                          <tr key={log.id}>
                            <td className="mono text-xs">{log.createdAt}</td>
                            <td>
                              <strong>{log.actor}</strong>
                            </td>
                            <td>
                              <span className="badge-shift">{log.role}</span>
                            </td>
                            <td>
                              <span className="mono font-semibold">{log.action}</span>
                            </td>
                            <td className="mono text-xs">{log.entity}: {log.entityId}</td>
                            <td>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  currentPage={auditPage}
                  totalItems={auditLogs.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setAuditPage}
                  itemLabel="audit logs"
                />
              </div>
            </div>
          )}
        </div>
        <ToastContainer />
      </main>

      {/* --- Application Inspection & Verification Modal --- */}
      {inspectingApp && session && (
        <ApplicationInspectionModal
          application={inspectingApp}
          detail={inspectingDetail}
          isLoading={isLoadingInspection}
          session={session}
          onClose={() => {
            setInspectingApp(null);
            setInspectingDetail(null);
          }}
          onRefreshQueue={async () => {
            await refreshAdminData(false);
          }}
          onNotifyToast={(title, msg, sev) => notifyToast(title, msg, sev)}
        />
      )}

      {/* --- Interactive Document Verification Modal --- */}
      {inspectingDoc && (
        <DocumentViewerModal
          document={inspectingDoc.doc}
          profile={inspectingDoc.profile}
          isOpen={Boolean(inspectingDoc)}
          onClose={() => setInspectingDoc(null)}
          onVerify={handleVerifyDocument}
        />
      )}
    </div>
  );
}
