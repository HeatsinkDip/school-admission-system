import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Info,
  X,
  XCircle,
} from 'lucide-react';

export interface ActionAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'SUCCESS' | 'WARNING' | 'DANGER' | 'INFO';
  title: string;
  message: string;
  detailReason?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  countdownSeconds?: number;
}

export const ActionAlertModal: React.FC<ActionAlertModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  detailReason,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  countdownSeconds,
}) => {
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle2 size={36} className="text-emerald-500" />;
      case 'WARNING':
        return <AlertTriangle size={36} className="text-amber-500" />;
      case 'DANGER':
        return <XCircle size={36} className="text-rose-500" />;
      default:
        return <Info size={36} className="text-indigo-500" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'SUCCESS':
        return 'border-emerald-500';
      case 'WARNING':
        return 'border-amber-500';
      case 'DANGER':
        return 'border-rose-500';
      default:
        return 'border-indigo-500';
    }
  };

  return (
    <div className="action-modal-backdrop" data-testid="action-alert-modal">
      <div className={`action-modal-container ${getBorderColor()}`}>
        <button
          type="button"
          className="action-modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="action-modal-header">
          <div className="action-modal-icon-box">{renderIcon()}</div>
          <div className="action-modal-title-box">
            <h3 className="action-modal-title">{title}</h3>
            {countdownSeconds !== undefined && countdownSeconds > 0 && (
              <div className="action-modal-timer">
                <Clock size={14} className="animate-spin" />
                <span>
                  {Math.floor(countdownSeconds / 60)}:
                  {String(Math.floor(countdownSeconds % 60)).padStart(2, '0')} remaining
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="action-modal-body">
          <p className="action-modal-msg">{message}</p>
          {detailReason && (
            <div className="action-modal-detail-box">
              <span className="font-semibold text-xs uppercase text-slate-500">Official Note / Valid Reason:</span>
              <p className="text-sm text-slate-800 mt-1">{detailReason}</p>
            </div>
          )}
        </div>

        <div className="action-modal-footer">
          {secondaryActionLabel && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (onSecondaryAction) onSecondaryAction();
                else onClose();
              }}
            >
              {secondaryActionLabel}
            </button>
          )}

          {primaryActionLabel ? (
            <button
              type="button"
              className={`btn ${type === 'DANGER' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => {
                if (onPrimaryAction) onPrimaryAction();
                else onClose();
              }}
            >
              {primaryActionLabel.includes('PDF') || primaryActionLabel.includes('Download') ? (
                <Download size={16} className="inline mr-1" />
              ) : null}
              {primaryActionLabel}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

