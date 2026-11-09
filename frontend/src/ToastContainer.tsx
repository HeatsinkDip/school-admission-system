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
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      data-testid="toast-container"
    >
      {toasts.map((toast) => {
        const getStyles = () => {
          switch (toast.severity) {
            case 'success':
              return {
                border: 'border-l-4 border-emerald-600',
                bg: 'bg-white',
                icon: <CheckCircle className="text-emerald-600 shrink-0" size={18} />,
                badge: 'bg-emerald-100 text-emerald-800',
              };
            case 'danger':
              return {
                border: 'border-l-4 border-rose-600',
                bg: 'bg-white',
                icon: <AlertCircle className="text-rose-600 shrink-0" size={18} />,
                badge: 'bg-rose-100 text-rose-800',
              };
            case 'warning':
              return {
                border: 'border-l-4 border-amber-500',
                bg: 'bg-white',
                icon: <AlertTriangle className="text-amber-500 shrink-0" size={18} />,
                badge: 'bg-amber-100 text-amber-900',
              };
            default:
              return {
                border: 'border-l-4 border-[#014d33]',
                bg: 'bg-white',
                icon: <Info className="text-[#014d33] shrink-0" size={18} />,
                badge: 'bg-emerald-50 text-emerald-900',
              };
          }
        };

        const config = getStyles();

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl p-3.5 shadow-xl border border-slate-200/90 ${config.bg} ${config.border} flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 animate-slideUp`}
            role="alert"
          >
            <div className="pt-0.5">{config.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-900 leading-snug">
                {toast.title}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition shrink-0"
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
export default ToastContainer;
