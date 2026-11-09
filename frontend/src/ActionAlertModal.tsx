import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
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
        return (
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
        );
      case 'WARNING':
        return (
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
        );
      case 'DANGER':
        return (
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
            <XCircle size={24} />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#004d3d] flex items-center justify-center shrink-0">
            <Info size={24} />
          </div>
        );
    }
  };

  const getHeaderAccent = () => {
    switch (type) {
      case 'SUCCESS':
        return 'border-emerald-600 bg-emerald-50/50';
      case 'WARNING':
        return 'border-amber-500 bg-amber-50/50';
      case 'DANGER':
        return 'border-rose-600 bg-rose-50/50';
      default:
        return 'border-[#014d33] bg-emerald-50/50';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn"
      data-testid="action-alert-modal"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl border-t-4 max-w-lg w-full shadow-2xl overflow-hidden animate-scaleUp ${getHeaderAccent()}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 flex items-start justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            {renderIcon()}
            <div>
              <h3 className="font-serif font-black text-lg text-slate-900 leading-tight">
                {title}
              </h3>
              {countdownSeconds !== undefined && countdownSeconds > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-mono font-bold tabular-nums mt-1">
                  <Clock size={12} className="animate-spin text-amber-700" />
                  <span>
                    {Math.floor(countdownSeconds / 60)}:
                    {String(Math.floor(countdownSeconds % 60)).padStart(2, '0')} remaining
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition shrink-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-3.5 text-xs text-slate-700">
          <p className="text-sm font-medium leading-relaxed text-slate-800">
            {message}
          </p>

          {detailReason && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-500 block mb-1">
                Official Note / System Explanation:
              </span>
              <p className="text-xs text-slate-900 font-semibold leading-normal">
                {detailReason}
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
          {secondaryActionLabel && (
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
              onClick={() => {
                if (onSecondaryAction) onSecondaryAction();
                onClose();
              }}
            >
              {secondaryActionLabel}
            </button>
          )}

          {primaryActionLabel ? (
            <button
              type="button"
              className="px-5 py-2 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-xs transition shadow-md"
              onClick={() => {
                if (onPrimaryAction) onPrimaryAction();
                onClose();
              }}
            >
              {primaryActionLabel}
            </button>
          ) : (
            <button
              type="button"
              className="px-5 py-2 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-xs transition"
              onClick={onClose}
            >
              Acknowledge & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default ActionAlertModal;
