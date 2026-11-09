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
  School,
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
import './AdminPortal.css';
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" data-testid="admin-login-screen">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <Shield size={26} />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Staff Portal Authentication</h2>
            <p className="text-xs text-slate-500">
              Restricted portal for authorized School Administration, Admission Officers, and Finance Staff.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold" role="alert" data-testid="error-banner">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3" noValidate>
            <div>
              <label htmlFor="admin-username-select" className="block text-xs font-bold text-slate-700 mb-1">
                Select Staff Role / Account
              </label>
              <select
                id="admin-username-select"
                data-testid="admin-username-select"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              >
                <option value="admin">Principal / Super Admin (Full System Access)</option>
                <option value="officer">Senior Admission Officer (Admissions & Documents)</option>
                <option value="accountant">Chief Finance Officer (Billing & Refunds)</option>
              </select>
            </div>

            <div>
              <label htmlFor="admin-password-input" className="block text-xs font-bold text-slate-700 mb-1">
                Security Password
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  id="admin-password-input"
                  data-testid="admin-password-input"
                  type="password"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter staff security password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="pt-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                1-Click Quick Fill Credentials:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition text-center truncate"
                  data-testid="quick-fill-admin-btn"
                  onClick={() => {
                    setLoginUsername('admin');
                    setLoginPassword('admin123');
                  }}
                >
                  Principal
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition text-center truncate"
                  onClick={() => {
                    setLoginUsername('officer');
                    setLoginPassword('officer123');
                  }}
                >
                  Admissions
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 transition text-center truncate"
                  onClick={() => {
                    setLoginUsername('accountant');
                    setLoginPassword('accountant123');
                  }}
                >
                  Finance
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
                data-testid="admin-login-btn"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? 'Authenticating Security Session...' : 'Sign In to Staff Console'}
              </button>

              <button
                type="button"
                className="w-full py-2 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
                data-testid="back-to-parent-btn"
                onClick={onNavigateToParent}
              >
                <ArrowLeft size={14} /> Return to Parent Portal
              </button>
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <BadgeCheck size={14} className="text-emerald-600" />
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
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col" data-testid="admin-console-view">
      <ToastContainer />

      {/* Top Navbar (Executive Slate theme - 50% compact height 52px) */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="px-3 sm:px-4 h-13 flex items-center justify-between gap-3">
          {/* Left Brand & Sidebar Hamburger */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
              aria-label="Toggle Sidebar"
            >
              <Menu size={16} />
            </button>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <School size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-xs sm:text-sm text-white">
                  ONNOROKOM PROJUKTI SCHOOL
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 rounded-full">
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Administrative Control Center & Live K8s Seat Management
              </p>
            </div>
          </div>

          {/* Right Action & Active Admin Pill */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-[10px] text-emerald-400 font-mono" title="Connected to PostgreSQL Database">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>PostgreSQL Active</span>
            </div>

            <button
              type="button"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
              onClick={() => void refreshAdminData(false)}
              title="Refresh Data"
            >
              <RefreshCw size={14} />
            </button>

            <NotificationCenter
              unreadCount={unreadNotifCount}
              notifications={notifications}
              onMarkRead={handleMarkAdminNotificationRead}
              onMarkAllRead={handleMarkAllAdminNotificationsRead}
              onRefresh={() => void refreshAdminData(true)}
              titleLabel="School System & Officer Alerts"
            />

            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-xs">
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-bold">
                {session.role}
              </span>
              <span className="font-semibold text-white text-xs truncate max-w-[120px]">
                {session.fullName}
              </span>
            </div>

            <button
              type="button"
              data-testid="back-to-parent-btn"
              onClick={onNavigateToParent}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold"
            >
              <ArrowLeft size={12} />
              <span>Parent Portal</span>
            </button>

            <button
              type="button"
              data-testid="admin-logout-btn"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-semibold transition"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container with Sticky Left Sidebar */}
      <div className="flex-1 flex relative">
        {/* Left Sidebar Navigation (Compact High-Density) */}
        <aside
          className={`bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-all duration-200 h-[calc(100vh-3.25rem)] sticky top-13 overflow-y-auto ${
            isSidebarCollapsed ? 'w-16 p-2' : 'w-60 p-2.5'
          }`}
        >
          <div className="space-y-3">
            {/* User Identity Mini Card */}
            {!isSidebarCollapsed && (
              <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1.5 border border-slate-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                    {isSuperAdmin ? 'SA' : isAdmissionOfficer ? 'AO' : 'FO'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{session.fullName}</div>
                    <div className="text-[10px] font-semibold text-emerald-400 truncate">
                      {isSuperAdmin
                        ? 'SUPER ADMIN'
                        : isAdmissionOfficer
                        ? 'ADMISSION OFFICER'
                        : 'FINANCE OFFICER'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Menu by Role */}
            <nav className="space-y-0.5">
              <div className="px-2 mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                {!isSidebarCollapsed ? 'General Console' : '•••'}
              </div>

              {/* Universal Overview */}
              <button
                type="button"
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'overview'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                data-testid="admin-tab-dashboard"
                onClick={() => setActiveView('overview')}
                title="Live Seats & Stats"
              >
                <div className="flex items-center gap-2 truncate">
                  <LayoutDashboard size={15} className={activeView === 'overview' ? 'text-emerald-700' : 'text-slate-400'} />
                  {!isSidebarCollapsed && <span className="truncate">Live Seats & Stats</span>}
                </div>
              </button>

              <button
                type="button"
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'alerts'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                data-testid="admin-tab-alerts"
                onClick={() => setActiveView('alerts')}
                title="Alerts & Live Feed"
              >
                <div className="flex items-center gap-2 truncate">
                  <Bell size={15} className={activeView === 'alerts' ? 'text-emerald-700' : 'text-slate-400'} />
                  {!isSidebarCollapsed && <span className="truncate">Alerts & Feed</span>}
                </div>
                {!isSidebarCollapsed && unreadNotifCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Admission Officer / Super Admin sections */}
              {(isSuperAdmin || isAdmissionOfficer) && (
                <>
                  <div className="px-2 pt-2.5 mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    {!isSidebarCollapsed ? 'Admissions' : '•••'}
                  </div>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'applications'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    data-testid="admin-tab-applications"
                    onClick={() => setActiveView('applications')}
                    title="Applications Queue"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Users size={15} className={activeView === 'applications' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Applications Queue</span>}
                    </div>
                    {!isSidebarCollapsed && applications.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                        {applications.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'doc_verification'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveView('doc_verification')}
                    title="Document Verification"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck2 size={15} className={activeView === 'doc_verification' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Doc Verification</span>}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'waitlist'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveView('waitlist')}
                    title="Waitlist Queue"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Clock size={15} className={activeView === 'waitlist' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Waitlist Queue</span>}
                    </div>
                    {!isSidebarCollapsed && waitlist.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                        {waitlist.length}
                      </span>
                    )}
                  </button>
                </>
              )}

              {/* Finance Officer / Super Admin sections */}
              {(isSuperAdmin || isAccountant) && (
                <>
                  <div className="px-2 pt-2.5 mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    {!isSidebarCollapsed ? 'Finance & Billing' : '•••'}
                  </div>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'finance'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    data-testid="admin-tab-finance"
                    onClick={() => setActiveView('finance')}
                    title="Payments & Collections"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <DollarSign size={15} className={activeView === 'finance' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Payments & Revenue</span>}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'refunds'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveView('refunds')}
                    title="Refunds Desk"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CreditCard size={15} className={activeView === 'refunds' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Refunds Desk</span>}
                    </div>
                  </button>
                </>
              )}

              {/* Classes & Fee Builder */}
              <div className="px-2 pt-2.5 mb-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                {!isSidebarCollapsed ? 'Academics & System' : '•••'}
              </div>

              <button
                type="button"
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'classes'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                data-testid="admin-tab-classes"
                onClick={() => setActiveView('classes')}
                title="Classes & Fee Builder"
              >
                <div className="flex items-center gap-2 truncate">
                  <GraduationCap size={15} className={activeView === 'classes' ? 'text-emerald-700' : 'text-slate-400'} />
                  {!isSidebarCollapsed && <span className="truncate">Classes & Fee Builder</span>}
                </div>
              </button>

              <button
                type="button"
                className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'routines'
                    ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                data-testid="admin-tab-routines"
                onClick={() => setActiveView('routines')}
                title="Class Routines & Hours"
              >
                <div className="flex items-center gap-2 truncate">
                  <Clock size={15} className={activeView === 'routines' ? 'text-emerald-700' : 'text-slate-400'} />
                  {!isSidebarCollapsed && <span className="truncate">Class Routines & Hours</span>}
                </div>
              </button>

              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'settings'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    data-testid="admin-tab-settings"
                    onClick={() => setActiveView('settings')}
                    title="Window & Rules"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Settings size={15} className={activeView === 'settings' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Window & Rules</span>}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-semibold transition ${
                      activeView === 'audit'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => setActiveView('audit')}
                    title="Audit Trail"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Shield size={15} className={activeView === 'audit' ? 'text-emerald-700' : 'text-slate-400'} />
                      {!isSidebarCollapsed && <span className="truncate">Audit Trail</span>}
                    </div>
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            {!isSidebarCollapsed && (
              <div className="space-y-1">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Simulate Role View:
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition truncate ${
                      isSuperAdmin ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => void handleSwitchRoleSimulation('admin', 'admin123')}
                  >
                    Principal
                  </button>
                  <button
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition truncate ${
                      isAdmissionOfficer ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => void handleSwitchRoleSimulation('officer', 'officer123')}
                  >
                    Admissions
                  </button>
                  <button
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition truncate ${
                      isAccountant ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => void handleSwitchRoleSimulation('accountant', 'accountant123')}
                  >
                    Finance
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                data-testid="back-to-parent-btn"
                onClick={onNavigateToParent}
              >
                <ArrowLeft size={14} />
                {!isSidebarCollapsed && <span>Parent Portal</span>}
              </button>

              <button
                type="button"
                className="w-full flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                data-testid="admin-logout-btn"
                onClick={() => void handleLogout()}
              >
                <LogOut size={14} />
                {!isSidebarCollapsed && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area (Compact 50% density) */}
        <main className="flex-1 p-3 sm:p-4.5 space-y-3.5 max-w-7xl mx-auto w-full overflow-y-auto">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Admin Console</span>
              <ChevronRight size={12} className="text-slate-400" />
              <strong className="text-slate-900 font-bold">
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

          {/* Global Alert Banners */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-semibold" role="alert" data-testid="error-banner">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                className="text-rose-500 hover:text-rose-800 text-base font-bold"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-semibold" role="status" data-testid="success-banner">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button
                type="button"
                className="text-emerald-500 hover:text-emerald-800 text-base font-bold"
                onClick={() => setSuccessMessage(null)}
                aria-label="Dismiss success"
              >
                ×
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: OVERVIEW & LIVE SEAT DASHBOARD                              */}
          {/* ================================================================= */}
          {activeView === 'overview' && dashboard && (
            <div className="space-y-3.5">
              {/* Metric Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                    <GraduationCap size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Capacity</span>
                    <strong className="text-lg font-black text-slate-900 leading-none">{dashboard.totalSeats}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">All class-shifts</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Temporary Holds</span>
                    <strong className="text-lg font-black text-amber-600 leading-none">{dashboard.totalHeld}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Expiring in 600s</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Confirmed Admissions</span>
                    <strong className="text-lg font-black text-emerald-600 leading-none">{dashboard.totalConfirmed}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Fee paid & confirmed</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Net Collections</span>
                    <strong className="text-lg font-black text-indigo-600 leading-none">৳{dashboard.totalRevenueBdt.toLocaleString()}</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">BDT Gateway</span>
                  </div>
                </div>
              </div>

              {/* Class-Shift Live Utilization Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Class-Shifts & Live Seat Pools</h3>
                    <p className="text-[11px] text-slate-500">
                      Zero over-selling guarantee enforced in PostgreSQL via row locks and DB clock.
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition"
                      onClick={() => setActiveView('classes')}
                    >
                      <PlusCircle size={13} /> Add New Class-Shift
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" data-testid="admin-classes-table">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2 px-3">Class / Shift ID</th>
                        <th className="py-2 px-3">Class & Shift Name</th>
                        <th className="py-2 px-3">Academic Year</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Total Seats</th>
                        <th className="py-2 px-3">Active Holds</th>
                        <th className="py-2 px-3">Confirmed Seats</th>
                        <th className="py-2 px-3">Available Seats</th>
                        <th className="py-2 px-3">Payable at Admission</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {dashboard.classes
                        .slice((classPage - 1) * PAGE_SIZE, classPage * PAGE_SIZE)
                        .map((cls) => (
                        <tr key={cls.id} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-3 font-mono font-semibold text-slate-700">{cls.id}</td>
                          <td className="py-1.5 px-3">
                            <strong className="text-slate-900">{cls.name}</strong>{' '}
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 ml-1">
                              {cls.shift}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{cls.academicYear}</td>
                          <td className="py-1.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              cls.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {cls.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-semibold text-slate-800">{cls.totalSeats}</td>
                          <td className="py-1.5 px-3 text-amber-600 font-semibold">{cls.heldSeats}</td>
                          <td className="py-1.5 px-3 text-emerald-600 font-semibold">{cls.confirmedSeats}</td>
                          <td className="py-1.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              cls.availableSeats > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {cls.availableSeats} Left
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-mono font-semibold text-slate-900">৳{cls.payableAtAdmissionTotal.toLocaleString()}</td>
                          <td className="py-1.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="px-2 py-0.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold transition"
                                onClick={() => startEditClass(cls)}
                                title="Edit class and fee configuration"
                              >
                                <Edit2 size={11} className="inline mr-0.5" />
                                Edit
                              </button>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition"
                                  onClick={() => void handleDeleteClass(cls)}
                                  title="Permanently delete class"
                                >
                                  <Trash2 size={11} className="inline mr-0.5" />
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

                <div className="p-2 border-t border-slate-100">
                  <Pagination
                    currentPage={classPage}
                    totalItems={dashboard.classes.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setClassPage}
                    itemLabel="classes"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: APPLICATION REVIEW QUEUE & DOSSIER INSPECTOR               */}
          {/* ================================================================= */}
          {(activeView === 'applications' || activeView === 'doc_verification') && (
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isAdmissionOfficer
                        ? 'Admission Officer — Applications & Document Verification'
                        : 'Application Dossier Verification Queue'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Verify child profile details, inspect uploaded certificates, recommend concessions, and assign student rolls.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 self-start sm:self-center transition"
                    onClick={handleExportCsv}
                  >
                    <Download size={13} /> Export CSV Roster
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-2.5 sm:p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Search ID, name, or hold ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  <div className="p-8 text-center text-slate-400">
                    <Users size={36} className="mx-auto mb-2 opacity-50" />
                    <h4 className="font-bold text-slate-700 text-sm">No Applications Found</h4>
                    <p className="text-xs text-slate-500">No student applications match the specified criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2 px-3">Hold ID</th>
                          <th className="py-2 px-3">Birth Reg No (17-digit)</th>
                          <th className="py-2 px-3">Child Full Name</th>
                          <th className="py-2 px-3">Class & Shift</th>
                          <th className="py-2 px-3">Seat Status</th>
                          <th className="py-2 px-3">Dossier Review</th>
                          <th className="py-2 px-3">Dossier Completeness</th>
                          <th className="py-2 px-3">Receipt / Paid</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {applications
                          .slice((appPage - 1) * PAGE_SIZE, appPage * PAGE_SIZE)
                          .map((app) => (
                          <tr
                            key={app.holdId}
                            className={`hover:bg-slate-50/70 transition ${
                              selectedStudentId === app.studentId ? 'bg-emerald-50/80 border-l-2 border-emerald-600' : ''
                            }`}
                          >
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{app.holdId}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-700">{app.studentId}</td>
                            <td className="py-1.5 px-3">
                              <strong className="text-slate-900">{app.fullNameEn || '— Incomplete —'}</strong>
                              {app.fullNameBn && <div className="text-[10px] text-slate-500">{app.fullNameBn}</div>}
                            </td>
                            <td className="py-1.5 px-3">
                              {app.className}{' '}
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 ml-1">
                                {app.shift}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                app.holdStatus === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.holdStatus === 'HELD'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {app.holdStatus}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                app.applicationStatus === 'APPROVED' || app.applicationStatus === 'ENROLLED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.applicationStatus === 'UNDER_REVIEW'
                                  ? 'bg-blue-100 text-blue-800'
                                  : app.applicationStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {app.applicationStatus}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-600"
                                    style={{ width: `${app.completenessPercent}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-600">{app.completenessPercent}%</span>
                              </div>
                            </td>
                            <td className="py-1.5 px-3 font-mono text-xs">
                              {app.receiptNo ? (
                                <span className="text-emerald-700 font-semibold">
                                  {app.receiptNo} (৳{app.netPaidAmount?.toLocaleString()})
                                </span>
                              ) : (
                                <span className="text-slate-400">Unpaid</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition flex items-center gap-1"
                                  data-testid={`inspect-student-${app.studentId}`}
                                  onClick={() => void openInspectionModal(app)}
                                >
                                  <Eye size={11} /> Inspect & Verify
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    className="p-1 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] transition"
                                    onClick={() => void handleDeleteApplication(app.studentId)}
                                    title="Delete student application record"
                                  >
                                    <Trash2 size={12} />
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

                <div className="p-2 border-t border-slate-100">
                  <Pagination
                    currentPage={appPage}
                    totalItems={applications.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setAppPage}
                    itemLabel="applications"
                  />
                </div>
              </div>

              {/* Selected Student Dossier Inspector Panel */}
              {selectedDetail && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3" data-testid="admin-dossier-panel">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedDetail.profile.studentId}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          selectedDetail.profile.applicationStatus === 'APPROVED' || selectedDetail.profile.applicationStatus === 'ENROLLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          Status: {selectedDetail.profile.applicationStatus}
                        </span>
                        {selectedDetail.profile.concessionRequested && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                            Need-Based Concession: {selectedDetail.profile.concessionStatus}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                        {selectedDetail.profile.fullNameEn || 'Unnamed Student'}{' '}
                        {selectedDetail.profile.fullNameBn && `(${selectedDetail.profile.fullNameBn})`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs self-start sm:self-center transition"
                      onClick={() => {
                        setSelectedStudentId(null);
                        setSelectedDetail(null);
                      }}
                    >
                      Close Dossier
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                    {/* Column 1: Student & Guardian Record */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs border-b border-slate-200 pb-1">
                        <Users size={14} className="text-emerald-600" /> Student & Guardian Record
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-500 block">Date of Birth:</span>
                          <span className="font-semibold text-slate-800">{selectedDetail.profile.dob || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Gender / Blood:</span>
                          <span className="font-semibold text-slate-800">{selectedDetail.profile.gender || '—'} / {selectedDetail.profile.bloodGroup || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">Father Name & NID:</span>
                          <span className="font-semibold text-slate-800">{selectedDetail.profile.fatherName || '—'} (NID: {selectedDetail.profile.fatherNid || '—'})</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Father Phone:</span>
                          <span className="font-mono font-semibold text-slate-800">{selectedDetail.profile.fatherPhone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Mother Name:</span>
                          <span className="font-semibold text-slate-800">{selectedDetail.profile.motherName || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">Present Address:</span>
                          <span className="text-slate-800">{selectedDetail.profile.presentAddress || '—'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">Previous School / Result:</span>
                          <span className="text-slate-800">{selectedDetail.profile.previousSchool || '—'} ({selectedDetail.profile.lastResult || '—'})</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Document Verification Table */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                          <FileCheck2 size={14} className="text-emerald-600" /> Document Verification Desk
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                          {selectedDetail.profile.documents.filter((d) => d.status === 'APPROVED').length} of {selectedDetail.profile.documents.length} Approved
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[9px]">
                              <th className="py-1 px-1.5">Type</th>
                              <th className="py-1 px-1.5">File</th>
                              <th className="py-1 px-1.5">Status</th>
                              <th className="py-1 px-1.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedDetail.profile.documents.map((doc) => (
                              <tr key={doc.type}>
                                <td className="py-1 px-1.5 font-semibold text-slate-800">{doc.label}</td>
                                <td className="py-1 px-1.5 font-mono text-[10px] text-slate-500 truncate max-w-[80px]">{doc.fileName || 'Not uploaded'}</td>
                                <td className="py-1 px-1.5">
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    doc.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {doc.status}
                                  </span>
                                </td>
                                <td className="py-1 px-1.5 text-right">
                                  <button
                                    type="button"
                                    className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold transition inline-flex items-center gap-0.5"
                                    onClick={() =>
                                      setInspectingDoc({
                                        doc,
                                        profile: selectedDetail.profile,
                                      })
                                    }
                                  >
                                    <Eye size={10} /> Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Concession Recommendation */}
                      {selectedDetail.profile.concessionRequested && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <strong className="text-amber-950">Tuition Concession Review</strong>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-200 text-amber-900">
                              {selectedDetail.profile.concessionStatus}
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-800">
                            Declared Monthly Income: ৳{selectedDetail.profile.monthlyIncome.toLocaleString()} BDT ({selectedDetail.profile.incomeBracket})
                          </p>
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="number"
                              min={5}
                              max={100}
                              className="px-2 py-0.5 text-xs rounded border border-amber-300 bg-white w-20"
                              placeholder="Discount %"
                              value={concessionPercentInput}
                              onChange={(e) => setConcessionPercentInput(e.target.value)}
                            />
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition"
                              onClick={() => void handleConcessionDecision('APPROVED')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-700 transition"
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
                  <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none"
                        placeholder="Officer remarks / instructions..."
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                      <input
                        type="text"
                        className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none"
                        placeholder="Section (e.g. Section A)"
                        value={assignedSection}
                        onChange={(e) => setAssignedSection(e.target.value)}
                      />
                      <input
                        type="text"
                        className="px-2.5 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono placeholder-slate-400 focus:outline-none"
                        placeholder="Student Roll No"
                        value={enrolledStudentNo}
                        onChange={(e) => setEnrolledStudentNo(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('UNDER_REVIEW')}
                      >
                        Mark Under Review
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('REQUEST_CORRECTION')}
                      >
                        Request Document Correction
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('APPROVE')}
                      >
                        Approve Dossier
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('ENROLL')}
                      >
                        <UserCheck size={12} /> Finalize Enrollment
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1"
                        disabled={isSubmittingReview}
                        onClick={() => void handleReviewAction('REJECT')}
                      >
                        <UserX size={12} /> Reject Application
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
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {isAccountant ? 'Finance Officer — Collections & Refunds Desk' : 'Admission Payments & Invoices'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Reconcile payments received, download audit-ready receipts, and process refunds.
                  </p>
                </div>

                {payments.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <DollarSign size={36} className="mx-auto mb-2 opacity-50" />
                    <h4 className="font-bold text-slate-700 text-sm">No Payments Recorded</h4>
                    <p className="text-xs text-slate-500">When guardians confirm their seat holds, payment records appear here in real-time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2 px-3">Receipt No</th>
                          <th className="py-2 px-3">Student Registration No</th>
                          <th className="py-2 px-3">Class-Shift</th>
                          <th className="py-2 px-3">Gross Total</th>
                          <th className="py-2 px-3">Concession Discount</th>
                          <th className="py-2 px-3">Net Paid (BDT)</th>
                          <th className="py-2 px-3">Gateway / Status</th>
                          <th className="py-2 px-3">Paid Timestamp</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {payments
                          .slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE)
                          .map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-900">{p.receiptNo}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-700">{p.studentId}</td>
                            <td className="py-1.5 px-3">{p.className}</td>
                            <td className="py-1.5 px-3 font-mono">৳{p.grossAmount.toLocaleString()}</td>
                            <td className="py-1.5 px-3 font-mono text-emerald-700">
                              {p.discountAmount > 0 ? `-৳${p.discountAmount.toLocaleString()}` : '—'}
                              {p.discountReason && <div className="text-[10px] text-slate-500">{p.discountReason}</div>}
                            </td>
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-900">৳{p.netAmount.toLocaleString()}</td>
                            <td className="py-1.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                p.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">{new Date(p.paidAt).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">
                              {p.status === 'SUCCESS' && (isSuperAdmin || isAccountant) && (
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition"
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

                <div className="p-2 border-t border-slate-100">
                  <Pagination
                    currentPage={paymentPage}
                    totalItems={payments.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPaymentPage}
                    itemLabel="payments"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: CLASSES & FEE BUILDER                                       */}
          {/* ================================================================= */}
          {activeView === 'classes' && (
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3" data-testid="create-class-section">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {editingClass ? `Edit Class-Shift (${editingClass.id})` : 'Class-Shift & Fee Structure Builder'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure capacity, admission fee, session charge, and monthly tuition.
                    </p>
                  </div>
                  {editingClass && (
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
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

                <form onSubmit={handleCreateOrUpdateClass} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs" noValidate>
                  <div>
                    <label htmlFor="class-name-input" className="block text-slate-700 font-bold mb-1">
                      {STRINGS.classNameLabel} *
                    </label>
                    <input
                      id="class-name-input"
                      data-testid="class-name-input"
                      type="text"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      placeholder="e.g. Class 6 - Morning Shift"
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      disabled={isSavingClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="class-shift-select" className="block text-slate-700 font-bold mb-1">
                      Shift
                    </label>
                    <select
                      id="class-shift-select"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newClassShift}
                      onChange={(e) => setNewClassShift(e.target.value)}
                    >
                      <option value="Morning">Morning Shift</option>
                      <option value="Day">Day Shift</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="total-seats-input" className="block text-slate-700 font-bold mb-1">
                      {STRINGS.totalSeatsLabel} *
                    </label>
                    <input
                      id="total-seats-input"
                      data-testid="total-seats-input"
                      type="number"
                      min={1}
                      step={1}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      placeholder="e.g. 120"
                      value={newClassSeats}
                      onChange={(e) => setNewClassSeats(e.target.value)}
                      disabled={isSavingClass}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Admission Status</label>
                    <select
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newClassStatus}
                      onChange={(e) => setNewClassStatus(e.target.value)}
                    >
                      <option value="OPEN">OPEN (Accepting Applications)</option>
                      <option value="CLOSED">CLOSED (Block New Holds)</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Admission Fee (BDT)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newAdmissionFee}
                      onChange={(e) => setNewAdmissionFee(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Session Charge (BDT)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newSessionCharge}
                      onChange={(e) => setNewSessionCharge(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Development Fee (BDT)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newDevelopmentFee}
                      onChange={(e) => setNewDevelopmentFee(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Security Deposit (Refundable)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newSecurityDeposit}
                      onChange={(e) => setNewSecurityDeposit(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">1st Month Tuition (BDT)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newFirstMonthTuition}
                      onChange={(e) => setNewFirstMonthTuition(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Monthly Tuition (Month 2+)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={newMonthlyTuition}
                      onChange={(e) => setNewMonthlyTuition(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
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
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">Class Waitlist Queue</h3>
                  <p className="text-[11px] text-slate-500">
                    Ordered first-come, first-served queue for students applying to fully occupied classes.
                  </p>
                </div>

                {waitlist.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Clock size={36} className="mx-auto mb-2 opacity-50" />
                    <h4 className="font-bold text-slate-700 text-sm">Waitlist Empty</h4>
                    <p className="text-xs text-slate-500">No applicants currently waiting in queue.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2 px-3">Queue Position</th>
                          <th className="py-2 px-3">Class-Shift</th>
                          <th className="py-2 px-3">Student Registration ID</th>
                          <th className="py-2 px-3">Child Name</th>
                          <th className="py-2 px-3">Joined Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {waitlist
                          .slice((waitlistPage - 1) * PAGE_SIZE, waitlistPage * PAGE_SIZE)
                          .map((w) => (
                          <tr key={w.id} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                #{w.position}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-slate-900">{w.className}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-700">{w.studentId}</td>
                            <td className="py-1.5 px-3">{w.studentName || '—'}</td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">{new Date(w.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-2 border-t border-slate-100">
                  <Pagination
                    currentPage={waitlistPage}
                    totalItems={waitlist.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setWaitlistPage}
                    itemLabel="waitlist entries"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: CLASS ROUTINES & FIXED OPERATING HOURS                      */}
          {/* ================================================================= */}
          {activeView === 'routines' && (
            <div className="space-y-3.5" data-testid="admin-routines-view">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 sm:p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Clock className="text-emerald-600" size={16} />
                      Class Routines & Fixed Operating Hours
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Inspect weekly timetable schedules, period breakdowns, teacher assignments, and classroom allocations.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 self-start sm:self-center transition"
                    onClick={() => void loadAllRoutines()}
                    disabled={isLoadingRoutines}
                  >
                    <RefreshCw size={13} className={isLoadingRoutines ? 'animate-spin' : ''} />
                    <span>Refresh Routines</span>
                  </button>
                </div>

                {routines.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">Select Class:</span>
                    {routines.map((r) => (
                      <button
                        key={r.classId}
                        type="button"
                        className={`px-2 py-0.5 rounded text-xs font-semibold border transition ${
                          selectedRoutine?.classId === r.classId
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
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
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs text-center p-8 text-slate-400">
                  <Clock size={36} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No class routines available yet. Create classes first to initialize default shift schedules.</p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW: ACADEMIC WINDOW & SETTINGS                                  */}
          {/* ================================================================= */}
          {activeView === 'settings' && isSuperAdmin && (
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-extrabold text-slate-900">Academic Year & Admission Window Policy</h3>
                  <p className="text-[11px] text-slate-500">Global settings governing hold deadlines and automatic concession rules.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Academic Year</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                      value={academicYearInput}
                      onChange={(e) => setAcademicYearInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Admission Opens (UTC ISO)</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={opensAtInput}
                      onChange={(e) => setOpensAtInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Admission Closes (UTC ISO)</label>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={closesAtInput}
                      onChange={(e) => setClosesAtInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Paperwork Deadline (Days)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={deadlineDaysInput}
                      onChange={(e) => setDeadlineDaysInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Automatic Sibling Discount (%)</label>
                    <input
                      type="number"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={siblingDiscountInput}
                      onChange={(e) => setSiblingDiscountInput(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3 pt-2">
                    <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">
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
            <div className="space-y-3.5" data-testid="admin-alerts-feed-view">
              {/* Broadcast Urgent Notice Tool */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Radio className="text-rose-500 animate-pulse" size={16} />
                      Live Activity Stream & Urgent Alert Dispatch
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Broadcast urgent announcements across the platform or stream real-time events triggered by parents and staff.
                    </p>
                  </div>
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 self-start sm:self-center transition"
                      onClick={handleMarkAllAdminNotificationsRead}
                    >
                      <CheckCheck size={13} /> Mark All Read
                    </button>
                  )}
                </div>

                <form className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2" onSubmit={handleBroadcastAlert}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Megaphone size={14} className="text-amber-500" />
                    <span>Dispatch School Notice / Alert Broadcast</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    <input
                      type="text"
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Notice Title (e.g. Admission Morning Shift 95% Filled)"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      required
                    />
                    <select
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={broadcastSeverity}
                      onChange={(e) => setBroadcastSeverity(e.target.value as any)}
                    >
                      <option value="INFO">Information (Blue)</option>
                      <option value="SUCCESS">Success Notice (Green)</option>
                      <option value="WARNING">Important Warning (Amber)</option>
                      <option value="DANGER">Urgent Alert (Red)</option>
                    </select>
                    <select
                      className="px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={broadcastRecipientType}
                      onChange={(e) => setBroadcastRecipientType(e.target.value)}
                    >
                      <option value="ALL">All Users (Parents + Staff)</option>
                      <option value="ALL_ADMINS">Staff Only</option>
                    </select>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <input
                      type="text"
                      className="flex-1 px-2.5 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Detailed alert announcement or instructions..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition disabled:opacity-50"
                      disabled={isBroadcasting}
                    >
                      <Send size={12} />
                      <span>{isBroadcasting ? 'Sending...' : 'Broadcast'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Activity Stream Feed */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {['ALL', 'SEAT_HOLD', 'PAYMENT', 'DOCUMENT', 'REVIEW', 'REFUND', 'SYSTEM'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                          alertFilterCategory === cat
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setAlertFilterCategory(cat)}
                      >
                        {cat === 'ALL' ? 'All Activity' : cat.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      className="pl-7 pr-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Search alerts or Student ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={12} className="absolute left-2 top-2 text-slate-400" />
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
                  <div className="p-8 text-center text-slate-400">
                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-slate-700 text-xs">No activity matching filter</p>
                    <span className="text-[11px] text-slate-500">Live events will stream here automatically as actions occur.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
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
                        className={`p-2.5 rounded-lg border transition cursor-pointer ${
                          notif.isRead ? 'bg-slate-50/50 border-slate-200 opacity-80' : 'bg-emerald-50/40 border-emerald-200'
                        }`}
                        onClick={() => {
                          if (!notif.isRead) void handleMarkAdminNotificationRead(notif.id);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              notif.severity === 'DANGER'
                                ? 'bg-rose-100 text-rose-800'
                                : notif.severity === 'WARNING'
                                ? 'bg-amber-100 text-amber-800'
                                : notif.severity === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {notif.category?.replace('_', ' ')}
                            </span>
                            <strong className="text-xs text-slate-900 font-bold">{notif.title}</strong>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 mt-1">{notif.message}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200/60">
                          <span>Actor: <strong className="text-slate-800">{notif.actor}</strong> {notif.recipientId && <span className="font-mono text-indigo-700 ml-2">ID: {notif.recipientId}</span>}</span>
                          <div className="flex items-center gap-1">
                            {!notif.isRead && (
                              <button
                                type="button"
                                className="px-1.5 py-0.2 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold"
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
                                className="p-0.5 rounded text-rose-600 hover:bg-rose-100"
                                title="Delete alert from feed"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteNotification(notif.id);
                                }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
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
            <div className="space-y-3.5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-3 sm:p-3.5 border-b border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900">Immutable System & Staff Audit Trail</h3>
                  <p className="text-[11px] text-slate-500">Every administrative decision, verification action, and payment update is recorded.</p>
                </div>

                {auditLogs.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">No audit events recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2 px-3">Timestamp (UTC)</th>
                          <th className="py-2 px-3">Staff Actor</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">Entity Ref</th>
                          <th className="py-2 px-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {auditLogs
                          .slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE)
                          .map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">{log.createdAt}</td>
                            <td className="py-1.5 px-3 font-bold text-slate-800">{log.actor}</td>
                            <td className="py-1.5 px-3">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {log.role}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-mono font-semibold text-slate-900">{log.action}</td>
                            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600">{log.entity}: {log.entityId}</td>
                            <td className="py-1.5 px-3 text-slate-700">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-2 border-t border-slate-100">
                  <Pagination
                    currentPage={auditPage}
                    totalItems={auditLogs.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setAuditPage}
                    itemLabel="audit logs"
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
