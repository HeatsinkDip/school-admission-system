import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  severity: 'success' | 'danger' | 'warning' | 'info';
  timestamp: number;
}

export function notifyToast(
  title: string,
  message: string,
  severity: 'success' | 'danger' | 'warning' | 'info' = 'info',
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('school:toast', {
        detail: { title, message, severity },
      }),
    );
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        title: string;
        message: string;
        severity?: 'success' | 'danger' | 'warning' | 'info';
      }>;
      if (!customEvent.detail) return;

      const newToast: ToastItem = {
        id: 'toast_' + Math.random().toString(36).substring(2, 9),
        title: customEvent.detail.title,
        message: customEvent.detail.message,
        severity: customEvent.detail.severity || 'info',
        timestamp: Date.now(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    };

    window.addEventListener('school:toast', handleToastEvent);
    return () => window.removeEventListener('school:toast', handleToastEvent);
  }, []);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.timestamp < 5000));
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-portal-container" aria-live="polite" data-testid="toast-container">
      {toasts.map((toast) => {
        const icon =
          toast.severity === 'success' ? (
            <CheckCircle className="toast-icon text-emerald-500" size={18} />
          ) : toast.severity === 'danger' ? (
            <AlertCircle className="toast-icon text-rose-500" size={18} />
          ) : toast.severity === 'warning' ? (
            <AlertTriangle className="toast-icon text-amber-500" size={18} />
          ) : (
            <Info className="toast-icon text-sky-500" size={18} />
          );

        return (
          <div key={toast.id} className={`toast-card toast-${toast.severity}`} role="alert">
            <div className="toast-icon-box">{icon}</div>
            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

