import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Info,
  RotateCcw,
  Sparkles,
  X,
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
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  titleLabel = 'Alerts & Notifications',
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

  const filteredNotifications = notifications.filter((notif) => {
    if (activeFilter === 'UNREAD') return !notif.isRead;
    if (activeFilter === 'IMPORTANT') {
      return (
        notif.severity === 'DANGER' ||
        notif.severity === 'WARNING' ||
        notif.category === 'PAYMENT' ||
        notif.category === 'REVIEW'
      );
    }
    return true;
  });

  const getCategoryIcon = (category: string, severity: string) => {
    switch (category) {
      case 'SEAT_HOLD':
        return <Clock size={16} className="text-amber-500" />;
      case 'PAYMENT':
        return <CreditCard size={16} className="text-emerald-500" />;
      case 'DOCUMENT':
        return <FileText size={16} className="text-indigo-500" />;
      case 'REVIEW':
        return severity === 'DANGER' ? (
          <AlertTriangle size={16} className="text-rose-500" />
        ) : (
          <CheckCircle2 size={16} className="text-emerald-500" />
        );
      case 'REFUND':
        return <RotateCcw size={16} className="text-purple-500" />;
      default:
        return <Info size={16} className="text-sky-500" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'SUCCESS':
        return 'severity-badge-success';
      case 'DANGER':
        return 'severity-badge-danger';
      case 'WARNING':
        return 'severity-badge-warning';
      default:
        return 'severity-badge-info';
    }
  };

  return (
    <div className="notification-center-root" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && onRefresh) onRefresh();
        }}
        data-testid="notification-bell-btn"
        aria-label="Open notifications"
        title="View live alerts and activity notifications"
      >
        <Bell size={18} className="bell-icon" />
        {unreadCount > 0 && (
          <span className="unread-badge-pill" data-testid="notification-badge" data-badge-unread="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-panel" data-testid="notification-dropdown">
          <div className="notif-panel-header">
            <div className="notif-header-title-box">
              <span className="notif-header-title">{titleLabel}</span>
              {unreadCount > 0 && (
                <span className="notif-unread-count-pill">{unreadCount} new</span>
              )}
            </div>
            <div className="notif-header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn-mark-all-read"
                  onClick={onMarkAllRead}
                  title="Mark all notifications as read"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button
                type="button"
                className="btn-close-tray"
                onClick={() => setIsOpen(false)}
                aria-label="Close tray"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notif-filter-bar">
            <button
              type="button"
              className={`notif-filter-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`notif-filter-btn ${activeFilter === 'UNREAD' ? 'active' : ''}`}
              onClick={() => setActiveFilter('UNREAD')}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`notif-filter-btn ${activeFilter === 'IMPORTANT' ? 'active' : ''}`}
              onClick={() => setActiveFilter('IMPORTANT')}
            >
              Important
            </button>
          </div>

          <div className="notif-scroll-area">
            {filteredNotifications.length === 0 ? (
              <div className="notif-empty-state">
                <Sparkles size={32} className="text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700">No alerts right now</p>
                <span className="text-xs text-slate-500">
                  You are completely caught up! New events and updates will appear here automatically.
                </span>
              </div>
            ) : (
              <ul className="notif-list">
                {filteredNotifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`notif-item ${notif.isRead ? 'read' : 'unread'}`}
                    data-testid={`notif-item-${notif.id}`}
                    onClick={() => {
                      if (!notif.isRead) onMarkRead(notif.id);
                    }}
                  >
                    <div className="notif-item-icon-box">
                      {getCategoryIcon(notif.category, notif.severity)}
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <span className={`notif-severity-badge ${getSeverityBadgeClass(notif.severity)}`}>
                          {notif.category?.replace('_', ' ')}
                        </span>
                        <span className="notif-timestamp">{formatRelativeTime(notif.createdAt)}</span>
                      </div>
                      <div className="notif-item-title">{notif.title}</div>
                      <div className="notif-item-msg">{notif.message}</div>
                      <div className="notif-item-footer">
                        <span className="notif-actor">By: {notif.actor}</span>
                        {!notif.isRead && <span className="notif-unread-dot" title="Unread" />}
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
