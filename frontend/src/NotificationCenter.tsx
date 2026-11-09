import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  CreditCard,
  FileText,
  Info,
  RotateCcw,
  Sparkles,
  X,
  ShieldCheck,
} from 'lucide-react';
import { AppNotification } from './types';

interface NotificationCenterProps {
  unreadCount: number;
  notifications: AppNotification[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onRefresh?: () => void;
  titleLabel?: string;
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSeconds < 45) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  unreadCount,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
  titleLabel = 'Alerts & Activity Updates',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'IMPORTANT'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const filteredNotifications = safeNotifications.filter((notif) => {
    if (activeFilter === 'UNREAD') return !notif.isRead;
    if (activeFilter === 'IMPORTANT') {
      return (
        notif.severity === 'DANGER' ||
        notif.severity === 'WARNING' ||
        notif.category === 'PAYMENT' ||
        notif.category === 'SEAT_HOLD'
      );
    }
    return true;
  });

  const getCategoryIcon = (category: string, severity: string) => {
    switch (category) {
      case 'SEAT_HOLD':
        return <Clock size={16} className="text-amber-500" />;
      case 'PAYMENT':
        return <CreditCard size={16} className="text-emerald-600" />;
      case 'DOCUMENT':
        return <FileText size={16} className="text-indigo-600" />;
      case 'REVIEW':
        return severity === 'DANGER' ? (
          <AlertTriangle size={16} className="text-rose-600" />
        ) : (
          <ShieldCheck size={16} className="text-emerald-600" />
        );
      case 'REFUND':
        return <RotateCcw size={16} className="text-purple-600" />;
      default:
        return <Info size={16} className="text-emerald-700" />;
    }
  };

  const getSeverityBadge = (severity: string, category: string) => {
    const catName = category?.replace('_', ' ') || 'NOTICE';
    switch (severity?.toUpperCase()) {
      case 'SUCCESS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">{catName}</span>;
      case 'DANGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">{catName}</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200">{catName}</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">{catName}</span>;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Redesigned Notification Bell Button */}
      <button
        type="button"
        className={`relative p-2 rounded-xl border transition flex items-center justify-center ${
          unreadCount > 0
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100 shadow-2xs'
            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        } ${isOpen ? 'ring-2 ring-emerald-600/30 border-emerald-600' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && onRefresh) onRefresh();
        }}
        data-testid="notification-bell-btn"
        aria-label="Open notifications"
        title="View live alerts and activity notifications"
      >
        <Bell size={18} className={unreadCount > 0 ? 'text-[#014d33]' : 'text-slate-600'} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 px-1.5 min-w-[20px] h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shadow-xs"
            data-testid="notification-badge"
            data-badge-unread="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel (Anti-AI-Slop Clean Style) */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col max-h-[85vh]"
          data-testid="notification-dropdown"
        >
          {/* Header Bar */}
          <div className="p-3.5 bg-[#004d3d] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-amber-300">
                <Bell size={14} />
              </div>
              <div>
                <span className="font-semibold text-xs block text-white">{titleLabel}</span>
                <span className="text-[10px] text-emerald-100 tabular-nums">
                  {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="px-2 py-1 rounded-md bg-white/15 hover:bg-white/25 text-[10px] font-bold text-emerald-100 transition flex items-center gap-1"
                  onClick={onMarkAllRead}
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={12} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                onClick={() => setIsOpen(false)}
                aria-label="Close tray"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 text-xs">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                activeFilter === 'ALL'
                  ? 'bg-white text-[#014d33] border border-slate-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({safeNotifications.length})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                activeFilter === 'UNREAD'
                  ? 'bg-white text-[#014d33] border border-slate-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              onClick={() => setActiveFilter('UNREAD')}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition ${
                activeFilter === 'IMPORTANT'
                  ? 'bg-white text-[#014d33] border border-slate-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              onClick={() => setActiveFilter('IMPORTANT')}
            >
              High Priority
            </button>
          </div>

          {/* Notification List Scroll Area */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[420px]">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                  <Sparkles size={22} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">No Notifications</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  You are completely caught up! Seat holds, document approvals, and payment receipts will appear here in real time.
                </p>
              </div>
            ) : (
              <ul>
                {filteredNotifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`p-3.5 transition cursor-pointer flex items-start gap-3 ${
                      notif.isRead
                        ? 'bg-white hover:bg-slate-50 opacity-80'
                        : 'bg-emerald-50/50 hover:bg-emerald-50/80 border-l-4 border-[#014d33]'
                    }`}
                    data-testid={`notif-item-${notif.id}`}
                    onClick={() => {
                      if (!notif.isRead) onMarkRead(notif.id);
                    }}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      {getCategoryIcon(notif.category, notif.severity)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {getSeverityBadge(notif.severity, notif.category)}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <div className="text-xs font-extrabold text-slate-900 leading-snug">
                        {notif.title}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                        {notif.message}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80 text-[10px] text-slate-400">
                        <span>By: <strong className="text-slate-600">{notif.actor || 'System'}</strong></span>
                        {!notif.isRead && (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                            <span>Click to mark read</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationCenter;
