import { getApiBaseUrl } from './config';
import { mapApiErrorToFriendlyMessage, STRINGS } from './strings';
import {
  AdminApplicationDetail,
  AdminApplicationSummary,
  AdminClassDetail,
  AdminDashboard,
  AdminSession,
  ApiErrorBody,
  AppNotification,
  AuditLogEntry,
  ClassFeeBreakdown,
  ConfirmHoldResponse,
  CreateClassResponse,
  HoldItem,
  NotificationSummary,
  PaymentRecord,
  SaveStudentProfilePayload,
  SchoolClass,
  SchoolSettings,
  StudentProfile,
  UpsertAdminClassPayload,
  WaitlistEntry,
} from './types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly friendlyMessage: string;

  constructor(status: number, code: string, message?: string) {
    const friendly = mapApiErrorToFriendlyMessage(code, message);
    super(friendly);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.friendlyMessage = friendly;
  }
}

/**
 * Tracks the difference between server clock and local browser clock (`serverMs - Date.now()`).
 * Updated whenever a response exposes `serverTime` in its JSON body or a `Date` HTTP header.
 */
let serverTimeOffsetMs = 0;

export function updateServerTimeOffset(isoTimestamp?: string | null): void {
  if (!isoTimestamp) return;
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isNaN(parsed)) {
    serverTimeOffsetMs = parsed - Date.now();
  }
}

export function getServerNowMs(): number {
  return Date.now() + serverTimeOffsetMs;
}

export function resetServerTimeOffsetForTests(): void {
  serverTimeOffsetMs = 0;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string,
  adminToken?: string,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (studentId) {
    headers.set('X-Student-Id', studentId);
  }
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', STRINGS.errors.NETWORK_ERROR);
  }

  const dateHeader = response.headers.get('Date');
  if (dateHeader) {
    updateServerTimeOffset(dateHeader);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const maybeServerTime = (data as { serverTime?: string }).serverTime;
    if (maybeServerTime) {
      updateServerTimeOffset(maybeServerTime);
    }
  } else if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as { serverTime?: string };
    if (first?.serverTime) {
      updateServerTimeOffset(first.serverTime);
    }
  }

  if (!response.ok) {
    const errBody = (data || {}) as ApiErrorBody;
    const code =
      errBody.code ||
      (response.status === 400
        ? 'VALIDATION_ERROR'
        : response.status === 401
          ? 'UNAUTHORIZED'
          : response.status === 403
            ? 'NOT_OWNER'
            : response.status === 404
              ? 'NOT_FOUND'
              : 'UNKNOWN_ERROR');
    throw new ApiClientError(response.status, code, errBody.message);
  }

  return data as T;
}

export const api = {
  // --- Core 8 Contract Endpoints ---
  createClass(name: string, totalSeats: number): Promise<CreateClassResponse> {
    return request<CreateClassResponse>('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, totalSeats }),
    });
  },

  listClasses(): Promise<SchoolClass[]> {
    return request<SchoolClass[]>('/classes');
  },

  getClass(classId: string): Promise<SchoolClass> {
    return request<SchoolClass>(`/classes/${encodeURIComponent(classId)}`);
  },

  applyForSeat(classId: string, studentId: string): Promise<HoldItem> {
    return request<HoldItem>(
      `/classes/${encodeURIComponent(classId)}/holds`,
      { method: 'POST' },
      studentId,
    );
  },

  getHold(holdId: string): Promise<HoldItem> {
    return request<HoldItem>(`/holds/${encodeURIComponent(holdId)}`);
  },

  confirmHold(holdId: string, studentId: string): Promise<ConfirmHoldResponse> {
    return request<ConfirmHoldResponse>(
      `/holds/${encodeURIComponent(holdId)}/confirm`,
      { method: 'POST' },
      studentId,
    );
  },

  cancelHold(holdId: string, studentId: string): Promise<void> {
    return request<void>(
      `/holds/${encodeURIComponent(holdId)}`,
      { method: 'DELETE' },
      studentId,
    );
  },

  getMyHolds(studentId: string): Promise<HoldItem[]> {
    return request<HoldItem[]>('/me/holds', { method: 'GET' }, studentId);
  },

  // --- Extended Parent Portal Endpoints ---
  getStudentProfile(studentId: string): Promise<StudentProfile> {
    return request<StudentProfile>('/parent/profile', { method: 'GET' }, studentId);
  },

  saveStudentProfile(
    studentId: string,
    payload: SaveStudentProfilePayload,
  ): Promise<StudentProfile> {
    return request<StudentProfile>(
      '/parent/profile',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      studentId,
    );
  },

  uploadDocument(
    studentId: string,
    type: string,
    label: string,
    fileName: string,
    fileSize: number,
  ): Promise<StudentProfile> {
    return request<StudentProfile>(
      '/parent/documents',
      {
        method: 'POST',
        body: JSON.stringify({ type, label, fileName, fileSize }),
      },
      studentId,
    );
  },

  getClassFeeBreakdown(classId: string, studentId?: string): Promise<ClassFeeBreakdown> {
    return request<ClassFeeBreakdown>(
      `/parent/classes/${encodeURIComponent(classId)}/fees`,
      { method: 'GET' },
      studentId,
    );
  },

  getStudentPayments(studentId: string): Promise<PaymentRecord[]> {
    return request<PaymentRecord[]>('/parent/payments', { method: 'GET' }, studentId);
  },

  joinWaitlist(classId: string, studentId: string): Promise<WaitlistEntry> {
    return request<WaitlistEntry>(
      `/parent/classes/${encodeURIComponent(classId)}/waitlist`,
      { method: 'POST' },
      studentId,
    );
  },

  getStudentWaitlist(studentId: string): Promise<WaitlistEntry[]> {
    return request<WaitlistEntry[]>('/parent/waitlist', { method: 'GET' }, studentId);
  },

  // --- Admin Auth & Console Endpoints ---
  loginAdmin(username: string, password: string): Promise<AdminSession> {
    return request<AdminSession>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getAdminMe(adminToken: string): Promise<AdminSession> {
    return request<AdminSession>('/auth/admin/me', { method: 'GET' }, undefined, adminToken);
  },

  logoutAdmin(adminToken: string): Promise<void> {
    return request<void>('/auth/admin/logout', { method: 'POST' }, undefined, adminToken);
  },

  getAdminDashboard(adminToken: string): Promise<AdminDashboard> {
    return request<AdminDashboard>('/admin/dashboard', { method: 'GET' }, undefined, adminToken);
  },

  updateAdminSettings(
    adminToken: string,
    payload: Partial<SchoolSettings>,
  ): Promise<SchoolSettings> {
    return request<SchoolSettings>(
      '/admin/settings',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  createAdminClass(
    adminToken: string,
    payload: UpsertAdminClassPayload,
  ): Promise<AdminClassDetail> {
    return request<AdminClassDetail>(
      '/admin/classes',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  updateAdminClass(
    adminToken: string,
    classId: string,
    payload: UpsertAdminClassPayload,
  ): Promise<AdminClassDetail> {
    return request<AdminClassDetail>(
      `/admin/classes/${encodeURIComponent(classId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  listAdminApplications(
    adminToken: string,
    filters?: {
      classId?: string;
      holdStatus?: string;
      applicationStatus?: string;
      search?: string;
    },
  ): Promise<AdminApplicationSummary[]> {
    const params = new URLSearchParams();
    if (filters?.classId) params.set('classId', filters.classId);
    if (filters?.holdStatus) params.set('holdStatus', filters.holdStatus);
    if (filters?.applicationStatus) params.set('applicationStatus', filters.applicationStatus);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    return request<AdminApplicationSummary[]>(
      `/admin/applications${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      adminToken,
    );
  },

  getAdminApplicationDetail(
    adminToken: string,
    studentId: string,
  ): Promise<AdminApplicationDetail> {
    return request<AdminApplicationDetail>(
      `/admin/applications/${encodeURIComponent(studentId)}`,
      { method: 'GET' },
      undefined,
      adminToken,
    );
  },

  reviewApplication(
    adminToken: string,
    studentId: string,
    payload: {
      action: 'UNDER_REVIEW' | 'APPROVE' | 'REQUEST_CORRECTION' | 'REJECT' | 'ENROLL';
      note?: string;
      assignedSection?: string;
      enrolledStudentNo?: string;
    },
  ): Promise<AdminApplicationDetail> {
    return request<AdminApplicationDetail>(
      `/admin/applications/${encodeURIComponent(studentId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  verifyDocument(
    adminToken: string,
    studentId: string,
    payload: { type: string; status: 'APPROVED' | 'CORRECTION_NEEDED' | 'PENDING'; comment?: string },
  ): Promise<StudentProfile> {
    return request<StudentProfile>(
      `/admin/applications/${encodeURIComponent(studentId)}/documents/verify`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  reviewConcession(
    adminToken: string,
    studentId: string,
    payload: { status: 'APPROVED' | 'DECLINED' | 'PENDING'; percent: number; note?: string },
  ): Promise<StudentProfile> {
    return request<StudentProfile>(
      `/admin/applications/${encodeURIComponent(studentId)}/concession`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      adminToken,
    );
  },

  listAdminPayments(adminToken: string): Promise<PaymentRecord[]> {
    return request<PaymentRecord[]>('/admin/payments', { method: 'GET' }, undefined, adminToken);
  },

  refundPayment(
    adminToken: string,
    paymentId: number,
    amount: number,
    reason: string,
  ): Promise<PaymentRecord> {
    return request<PaymentRecord>(
      `/admin/payments/${paymentId}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({ amount, reason }),
      },
      undefined,
      adminToken,
    );
  },

  listAdminWaitlist(adminToken: string): Promise<WaitlistEntry[]> {
    return request<WaitlistEntry[]>('/admin/waitlist', { method: 'GET' }, undefined, adminToken);
  },

  listAuditLogs(adminToken: string): Promise<AuditLogEntry[]> {
    return request<AuditLogEntry[]>('/admin/audit-logs', { method: 'GET' }, undefined, adminToken);
  },

  getNotifications(studentId?: string): Promise<NotificationSummary> {
    return fetchNotifications(studentId);
  },

  getAdminNotifications(
    adminToken: string,
    category?: string,
    unreadOnly?: boolean,
  ): Promise<NotificationSummary> {
    return fetchAdminNotifications(adminToken, category, unreadOnly);
  },
};

export async function fetchNotifications(studentId?: string): Promise<NotificationSummary> {
  try {
    return await request<NotificationSummary>('/notifications', { method: 'GET' }, studentId);
  } catch {
    return { unreadCount: 0, notifications: [] };
  }
}

export async function markNotificationRead(id: number, studentId?: string): Promise<void> {
  try {
    await request<void>(`/notifications/${id}/read`, { method: 'POST' }, studentId);
  } catch {
    // Non-blocking
  }
}

export async function markAllNotificationsRead(studentId?: string): Promise<void> {
  try {
    await request<void>('/notifications/mark-all-read', { method: 'POST' }, studentId);
  } catch {
    // Non-blocking
  }
}

export async function fetchAdminNotifications(
  adminToken: string,
  category?: string,
  unreadOnly?: boolean,
): Promise<NotificationSummary> {
  try {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (unreadOnly) params.set('unreadOnly', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return await request<NotificationSummary>(`/admin/notifications${query}`, { method: 'GET' }, undefined, adminToken);
  } catch {
    return { unreadCount: 0, notifications: [] };
  }
}

export async function markAdminNotificationRead(id: number, adminToken: string): Promise<void> {
  try {
    await request<void>(`/admin/notifications/${id}/read`, { method: 'POST' }, undefined, adminToken);
  } catch {
    // Non-blocking
  }
}

export async function markAllAdminNotificationsRead(adminToken: string): Promise<void> {
  try {
    await request<void>('/admin/notifications/mark-all-read', { method: 'POST' }, undefined, adminToken);
  } catch {
    // Non-blocking
  }
}

export async function broadcastAdminNotification(
  adminToken: string,
  payload: { title: string; message: string; category?: string; severity?: string; recipientType?: string; recipientId?: string },
): Promise<AppNotification> {
  return await request<AppNotification>('/admin/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, undefined, adminToken);
}
