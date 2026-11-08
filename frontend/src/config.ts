/**
 * Resolves the backend API base URL in priority order:
 * 1. Runtime window.__CONFIG__.API_BASE_URL written by Docker container entrypoint (/config.js)
 * 2. Build-time/dev VITE_API_URL environment variable
 * 3. Default http://localhost:8080
 */
export function getApiBaseUrl(): string {
  const runtimeUrl =
    typeof window !== 'undefined' ? window.__CONFIG__?.API_BASE_URL?.trim() : undefined;
  if (runtimeUrl) {
    return runtimeUrl.replace(/\/+$/, '');
  }

  const viteUrl = import.meta.env?.VITE_API_URL?.trim();
  if (viteUrl) {
    return viteUrl.replace(/\/+$/, '');
  }

  return 'http://localhost:8080';
}

export const POLL_INTERVAL_MS = 4000;
export const STUDENT_ID_STORAGE_KEY = 'school_admission_student_id';
export const ADMIN_TOKEN_STORAGE_KEY = 'school_admission_admin_token';
export const ADMIN_USER_STORAGE_KEY = 'school_admission_admin_user';
