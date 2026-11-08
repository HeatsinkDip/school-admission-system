import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  Download,
  ZoomIn,
  ShieldCheck,
  Calendar,
  User,
  HardDrive,
  Eye,
  Check,
} from 'lucide-react';
import { DocumentItem, StudentProfile } from './types';

interface DocumentViewerModalProps {
  document: DocumentItem;
  profile: StudentProfile;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (type: string, status: 'APPROVED' | 'CORRECTION_NEEDED', comment: string) => Promise<void>;
}

export function DocumentViewerModal({
  document,
  profile,
  isOpen,
  onClose,
  onVerify,
}: DocumentViewerModalProps) {
  const [comment, setComment] = useState(document.reviewerComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeZoom, setActiveZoom] = useState<'fit' | 'in'>('fit');

  if (!isOpen) return null;

  const quickCorrectionTags = [
    'Blurry or unreadable scan',
    'Date of birth does not match profile',
    'Missing official stamp or seal',
    'Name spelling discrepancy',
    'Incomplete or cropped pages',
    'Document expired or superseded',
  ];

  const handleApplyTag = (tag: string) => {
    setComment((prev) => (prev ? `${prev}; ${tag}` : tag));
  };

  const handleAction = async (status: 'APPROVED' | 'CORRECTION_NEEDED') => {
    setIsSubmitting(true);
    try {
      await onVerify(
        document.type,
        status,
        status === 'APPROVED' && !comment ? 'Verified by Admission Office' : comment,
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container doc-review-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="doc-icon-badge">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="modal-title">{document.label}</h3>
              <p className="modal-subtitle">
                Student ID: <span className="mono font-semibold">{profile.studentId}</span> •{' '}
                {profile.fullNameEn || 'Applicant'}
              </p>
            </div>
          </div>
          <div className="modal-header-actions">
            <span className={`status-badge status-${document.status.toLowerCase()}`}>
              {document.status === 'NOT_UPLOADED' ? 'Pending Upload' : document.status}
            </span>
            <button
              type="button"
              className="btn-icon-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view (Preview on Left, Review tools on Right) */}
        <div className="modal-body-split">
          {/* Left Preview Pane */}
          <div className="doc-preview-pane">
            <div className="doc-preview-toolbar">
              <span className="doc-preview-title">
                <Eye size={16} /> Document Visual Inspector
              </span>
              <div className="doc-preview-tools">
                <button
                  type="button"
                  className={`btn-tool ${activeZoom === 'in' ? 'active' : ''}`}
                  onClick={() => setActiveZoom(activeZoom === 'fit' ? 'in' : 'fit')}
                  title="Toggle Zoom"
                >
                  <ZoomIn size={15} /> {activeZoom === 'fit' ? 'Zoom 150%' : 'Fit'}
                </button>
                <a
                  href={`#download-${document.fileName}`}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Downloading simulated verified file: ${document.fileName || 'document.pdf'}`);
                  }}
                  className="btn-tool"
                  title="Download File"
                >
                  <Download size={15} /> Download
                </a>
              </div>
            </div>

            <div className={`doc-canvas ${activeZoom === 'in' ? 'zoomed' : ''}`}>
              {/* Specialized Interactive Visualizers */}
              {document.type === 'BIRTH_CERT' && (
                <div className="simulated-doc birth-cert-sheet">
                  <div className="cert-header">
                    <div className="govt-seal">🇧🇩</div>
                    <h4>GOVERNMENT OF THE PEOPLE&apos;S REPUBLIC OF BANGLADESH</h4>
                    <p className="cert-sub">Office of the Registrar of Birth and Death</p>
                    <div className="cert-title-badge">BIRTH REGISTRATION CERTIFICATE</div>
                  </div>
                  <div className="cert-body">
                    <div className="cert-field-row">
                      <span className="field-lbl">Registration No (BRN):</span>
                      <strong className="field-val mono">{profile.studentId}</strong>
                    </div>
                    <div className="cert-field-row">
                      <span className="field-lbl">Full Name (English):</span>
                      <strong className="field-val">{profile.fullNameEn || '—'}</strong>
                    </div>
                    {profile.fullNameBn && (
                      <div className="cert-field-row">
                        <span className="field-lbl">পূর্ণ নাম (বাংলা):</span>
                        <strong className="field-val">{profile.fullNameBn}</strong>
                      </div>
                    )}
                    <div className="cert-field-row">
                      <span className="field-lbl">Date of Birth:</span>
                      <span className="field-val font-semibold">{profile.dob || '—'}</span>
                    </div>
                    <div className="cert-field-row">
                      <span className="field-lbl">Gender:</span>
                      <span className="field-val">{profile.gender || 'Not specified'}</span>
                    </div>
                    <div className="cert-field-row">
                      <span className="field-lbl">Father&apos;s Name:</span>
                      <span className="field-val">{profile.fatherName || '—'}</span>
                    </div>
                    <div className="cert-field-row">
                      <span className="field-lbl">Mother&apos;s Name:</span>
                      <span className="field-val">{profile.motherName || '—'}</span>
                    </div>
                    <div className="cert-field-row">
                      <span className="field-lbl">Permanent Address:</span>
                      <span className="field-val">{profile.permanentAddress || profile.presentAddress || '—'}</span>
                    </div>
                  </div>
                  <div className="cert-footer">
                    <div className="qr-sim">
                      <div className="qr-box" />
                      <span>Scan to Verify</span>
                    </div>
                    <div className="seal-sim">
                      <div className="stamp-circle">OFFICIALLY REGISTERED</div>
                    </div>
                  </div>
                </div>
              )}

              {document.type === 'STUDENT_PHOTO' && (
                <div className="simulated-doc photo-sheet">
                  <div className="passport-frame">
                    <div className="avatar-preview">
                      <User size={84} className="avatar-icon" />
                    </div>
                    <p className="photo-spec">Official Passport Size (45mm × 35mm)</p>
                    <span className="photo-name">{profile.fullNameEn || profile.studentId}</span>
                    <span className="photo-id mono">{profile.studentId}</span>
                  </div>
                  <div className="photo-checklist">
                    <div className="check-item"><Check size={14} className="text-emerald" /> White background verified</div>
                    <div className="check-item"><Check size={14} className="text-emerald" /> Front-facing neutral expression</div>
                    <div className="check-item"><Check size={14} className="text-emerald" /> High resolution (300 DPI)</div>
                  </div>
                </div>
              )}

              {document.type === 'PARENTS_NID' && (
                <div className="simulated-doc nid-sheet">
                  <div className="nid-card">
                    <div className="nid-top">
                      <span>NATIONAL IDENTITY CARD</span>
                      <span className="chip" />
                    </div>
                    <div className="nid-main">
                      <div className="nid-pic"><User size={40} /></div>
                      <div className="nid-info">
                        <strong>Name: {profile.fatherName || 'Father'}</strong>
                        <div>NID: <span className="mono">{profile.fatherNid || '19842691234567890'}</span></div>
                        <div>DOB: 12 Jan 1982</div>
                      </div>
                    </div>
                  </div>
                  <div className="nid-card">
                    <div className="nid-top">
                      <span>NATIONAL IDENTITY CARD</span>
                      <span className="chip" />
                    </div>
                    <div className="nid-main">
                      <div className="nid-pic"><User size={40} /></div>
                      <div className="nid-info">
                        <strong>Name: {profile.motherName || 'Mother'}</strong>
                        <div>NID: <span className="mono">{profile.motherNid || '19872691234567891'}</span></div>
                        <div>DOB: 05 Aug 1986</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {document.type === 'PREV_SCHOOL_TC' && (
                <div className="simulated-doc tc-sheet">
                  <div className="tc-header">
                    <h4>ACADEMIC TRANSFER CERTIFICATE & REPORT</h4>
                    <p className="text-muted">Issued by: {profile.previousSchool || 'Previous Recognized Institution'}</p>
                  </div>
                  <div className="tc-body">
                    <p>This certifies that <strong>{profile.fullNameEn || 'The Student'}</strong> was enrolled in good standing.</p>
                    <table className="mini-table">
                      <tbody>
                        <tr><td>Last Class Attended:</td><td><strong>{profile.lastClassPassed || 'Class 5'}</strong></td></tr>
                        <tr><td>Exam Result / GPA:</td><td><strong>{profile.lastResult || 'GPA 5.00'}</strong></td></tr>
                        <tr><td>Conduct & Character:</td><td>Satisfactory / Exemplary</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="tc-footer">
                    <span>Date: 2026-11-01</span>
                    <span className="sig">Signed by Headmaster [SEALED]</span>
                  </div>
                </div>
              )}

              {document.type === 'INCOME_PROOF' && (
                <div className="simulated-doc income-sheet">
                  <div className="income-header">
                    <h4>HOUSEHOLD INCOME & EMPLOYMENT CERTIFICATE</h4>
                    <span className="badge-concession">Need-Based Scholarship Verification</span>
                  </div>
                  <div className="income-body">
                    <div className="income-stat">
                      <span>Declared Monthly Household Income:</span>
                      <strong>৳{profile.monthlyIncome.toLocaleString()} BDT</strong>
                    </div>
                    <div className="income-stat">
                      <span>Income Bracket:</span>
                      <span>{profile.incomeBracket || '25,000 - 50,000 BDT'}</span>
                    </div>
                    <div className="income-stat">
                      <span>Income Source:</span>
                      <span>{profile.incomeSource || 'Salaried / Professional'}</span>
                    </div>
                    <div className="income-stat">
                      <span>Dependents in Household:</span>
                      <span>{profile.dependents} persons</span>
                    </div>
                  </div>
                  <p className="disclaimer-note">
                    Verified for tuition concession eligibility. Seat allocation remains first-come, first-served.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Review Controls Pane */}
          <div className="doc-controls-pane">
            <h4 className="controls-heading">
              <ShieldCheck size={18} className="text-indigo" /> Document Verification Desk
            </h4>

            <div className="metadata-card">
              <div className="meta-item">
                <HardDrive size={14} className="meta-icon" />
                <span className="meta-label">File:</span>
                <span className="meta-value mono">{document.fileName || 'pending_upload.pdf'}</span>
              </div>
              <div className="meta-item">
                <Calendar size={14} className="meta-icon" />
                <span className="meta-label">Uploaded:</span>
                <span className="meta-value">{document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'Draft'}</span>
              </div>
              <div className="meta-item">
                <User size={14} className="meta-icon" />
                <span className="meta-label">Current Status:</span>
                <span className={`status-badge status-${document.status.toLowerCase()}`}>
                  {document.status}
                </span>
              </div>
            </div>

            {/* Quick Correction Presets */}
            <div className="quick-presets-section">
              <label className="form-label text-sm">
                Quick Rejection / Correction Tags:
              </label>
              <div className="tag-cloud">
                {quickCorrectionTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-chip"
                    onClick={() => handleApplyTag(tag)}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Officer Remarks Input */}
            <div className="form-field">
              <label className="form-label" htmlFor="doc-reviewer-comment">
                Officer Remarks & Instructions for Parent:
              </label>
              <textarea
                id="doc-reviewer-comment"
                className="input textarea"
                rows={3}
                placeholder="Add comments, verification notes, or specific re-upload instructions..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="review-action-stack">
              <button
                type="button"
                className="btn btn-success btn-full"
                disabled={isSubmitting}
                onClick={() => void handleAction('APPROVED')}
              >
                <CheckCircle size={18} />
                {isSubmitting ? 'Updating...' : 'Approve & Mark Verified'}
              </button>

              <button
                type="button"
                className="btn btn-danger btn-full"
                disabled={isSubmitting}
                onClick={() => void handleAction('CORRECTION_NEEDED')}
              >
                <AlertTriangle size={18} />
                {isSubmitting ? 'Updating...' : 'Flag as Needs Correction'}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-full"
                onClick={onClose}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
