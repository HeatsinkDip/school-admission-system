import { getApiBaseUrl } from './config';
import { mapApiErrorToFriendlyMessage, STRINGS } from './strings';
import {
  ApiErrorBody,
  ConfirmHoldResponse,
  CreateClassResponse,
  HoldItem,
  SchoolClass,
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
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (studentId) {
    headers.set('X-Student-Id', studentId);
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
};

