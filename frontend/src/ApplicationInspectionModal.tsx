import React, { useState } from 'react';
import {
  CheckCircle2,
  DollarSign,
  FileCheck2,
  FileText,
  GraduationCap,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { api } from './api';
import {
  AdminApplicationDetail,
  AdminApplicationSummary,
  AdminSession,
} from './types';

interface ApplicationInspectionModalProps {
  application: AdminApplicationSummary;
  detail: AdminApplicationDetail | null;
  isLoading: boolean;
  session: AdminSession;
  onClose: () => void;
  onRefreshQueue: () => Promise<void>;
  onNotifyToast: (title: string, message: string, severity: 'success' | 'warning' | 'danger' | 'info') => void;
}

export const ApplicationInspectionModal: React.FC<ApplicationInspectionModalProps> = ({
  application,
  detail,
  isLoading,
  session,
  onClose,
  onRefreshQueue,
  onNotifyToast,
}) => {
  const profile = detail?.profile;
  const payments = detail?.payments || [];

  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'financials'>('profile');
  const [decisionAction, setDecisionAction] = useState<string>(
    application.applicationStatus === 'DRAFT' || application.applicationStatus === 'SUBMITTED'
      ? 'ELIGIBLE'
      : 'APPROVE',
  );
  const [assignedSection, setAssignedSection] = useState<string>(
    application.assignedSection || 'Section A - Padma',
  );
  const [enrolledStudentNo, setEnrolledStudentNo] = useState<string>(
    application.enrolledStudentNo || `2027-${application.studentId.slice(-4)}`,
  );
  const [reviewerNote, setReviewerNote] = useState<string>(application.reviewerNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyingDocType, setVerifyingDocType] = useState<string | null>(null);

  const handleDocumentVerify = async (docType: string, docStatus: 'APPROVED' | 'CORRECTION_NEEDED') => {
    setVerifyingDocType(docType);
    try {
      await api.verifyDocument(
        session.token,
        application.studentId,
        {
          type: docType,
          status: docStatus,
          comment: docStatus === 'APPROVED' ? 'Verified by Officer' : 'Illegible / Mismatched document',
        },
      );
      onNotifyToast(
        'Document Updated',
        `Document ${docType} was marked ${docStatus}.`,
        docStatus === 'APPROVED' ? 'success' : 'warning',
      );
      await onRefreshQueue();
    } catch (err: any) {
      onNotifyToast('Verification Failed', err.message || 'Error updating document', 'danger');
    } finally {
      setVerifyingDocType(null);
    }
  };

  const handleSaveDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const mappedAction: 'UNDER_REVIEW' | 'APPROVE' | 'REQUEST_CORRECTION' | 'REJECT' | 'ENROLL' =
        decisionAction === 'ELIGIBLE'
          ? 'APPROVE'
          : decisionAction === 'REQUEST_CHANGES'
          ? 'REQUEST_CORRECTION'
          : (decisionAction as any);

      await api.reviewApplication(
        session.token,
        application.studentId,
        {
          action: mappedAction,
          note: reviewerNote,
          assignedSection: mappedAction === 'APPROVE' || mappedAction === 'ENROLL' ? assignedSection : undefined,
          enrolledStudentNo: mappedAction === 'APPROVE' || mappedAction === 'ENROLL' ? enrolledStudentNo : undefined,
        },
      );
      onNotifyToast(
        'Application Verified',
        `Student ${application.studentId} status updated to ${decisionAction}.`,
        'success',
      );
      await onRefreshQueue();
      onClose();
    } catch (err: any) {
      onNotifyToast('Inspection Error', err.message || 'Failed to submit review decision', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container inspection-modal max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="inspection-modal-header p-5 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge badge-primary">{application.className}</span>
              <span className="badge badge-outline">{application.shift} Shift</span>
              <span
                className={`status-chip ${
                  application.applicationStatus === 'APPROVED' || application.applicationStatus === 'ELIGIBLE'
                    ? 'status-chip-confirmed'
                    : application.applicationStatus === 'REJECTED'
                    ? 'status-chip-expired'
                    : 'status-chip-held'
                }`}
              >
                {application.applicationStatus}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1">
              {profile?.fullNameEn || application.fullNameEn || 'Applicant Dossier'}
              {profile?.fullNameBn && (
                <span className="text-sm font-normal text-slate-500 ml-2">({profile.fullNameBn})</span>
              )}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>
                Birth Reg No (17 digits): <strong className="mono text-slate-800">{application.studentId}</strong>
              </span>
              <span>•</span>
              <span>
                Applied: <strong>{new Date(application.createdAt).toLocaleDateString()}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            title="Close Inspector"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="inspection-modal-tabs flex border-b border-slate-200 px-5 pt-3 bg-white">
          <button
            type="button"
            className={`tab-btn flex items-center gap-1.5 pb-2 px-3 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>Student & Family Profile</span>
          </button>
          <button
            type="button"
            className={`tab-btn flex items-center gap-1.5 pb-2 px-3 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={15} />
            <span>Documents ({profile?.documents?.length || 0})</span>
          </button>
          <button
            type="button"
            className={`tab-btn flex items-center gap-1.5 pb-2 px-3 border-b-2 font-medium text-sm ${
              activeTab === 'financials'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('financials')}
          >
            <DollarSign size={15} />
            <span>Seat & Payment Receipts ({payments.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="inspection-modal-body p-5 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading student dossier...</div>
          ) : activeTab === 'profile' ? (
            <div className="space-y-4">
              {/* Biographical Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <GraduationCap size={16} className="text-indigo-600" />
                  <span>Student Biographical Information</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Date of Birth:</span>
                    <strong className="text-slate-800">{profile?.dob || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Gender:</span>
                    <strong className="text-slate-800">{profile?.gender || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Blood Group:</span>
                    <strong className="text-slate-800">{profile?.bloodGroup || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nationality:</span>
                    <strong className="text-slate-800">{profile?.nationality || 'Bangladeshi'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Religion:</span>
                    <strong className="text-slate-800">{profile?.religion || 'Not Provided'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Previous School:</span>
                    <strong className="text-slate-800">{profile?.previousSchool || 'None / First Admission'}</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-500 block">Present Address:</span>
                    <span className="text-slate-800">{profile?.presentAddress || 'Not Provided'}</span>
                  </div>
                </div>
              </div>

              {/* Parents / Guardian */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Users size={16} className="text-emerald-600" />
                  <span>Guardians & Emergency Contact</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <strong className="block text-slate-700 mb-1">Father:</strong>
                    <div>Name: {profile?.fatherName || 'N/A'}</div>
                    <div>NID: {profile?.fatherNid || 'N/A'}</div>
                    <div>Phone: {profile?.fatherPhone || 'N/A'}</div>
                    <div>Occupation: {profile?.fatherOccupation || 'N/A'}</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <strong className="block text-slate-700 mb-1">Mother:</strong>
                    <div>Name: {profile?.motherName || 'N/A'}</div>
                    <div>NID: {profile?.motherNid || 'N/A'}</div>
                    <div>Phone: {profile?.motherPhone || 'N/A'}</div>
                    <div>Occupation: {profile?.motherOccupation || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Household & Concession */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500">Monthly Household Income:</span>
                  <strong className="text-slate-800 block text-sm">
                    ৳{profile?.monthlyIncome?.toLocaleString() || '0'} ({profile?.incomeBracket || 'Unspecified'})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Sibling Concession:</span>
                  <strong className="text-slate-800 block">
                    {profile?.hasSibling ? `Yes (${profile.siblingName} - ${profile.siblingClass})` : 'None'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Dossier Completeness:</span>
                  <strong className="text-indigo-600 block text-sm">{profile?.completenessPercent || 0}%</strong>
                </div>
              </div>
            </div>
          ) : activeTab === 'documents' ? (
            <div className="space-y-3">
              {profile?.documents && profile.documents.length > 0 ? (
                profile.documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center flex-wrap gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCheck2 size={16} className="text-indigo-600" />
                        <strong className="text-sm text-slate-800">{doc.label || doc.type}</strong>
                        <span
                          className={`badge ${
                            doc.status === 'VERIFIED'
                              ? 'badge-success'
                              : doc.status === 'REJECTED'
                              ? 'badge-danger'
                              : 'badge-muted'
                          } text-xs`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        File: {doc.fileName} • {Math.round(doc.fileSize / 1024)} KB • Uploaded:{' '}
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                      {doc.reviewerComment && (
                        <div className="text-xs text-amber-700 mt-1">Note: {doc.reviewerComment}</div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleDocumentVerify(doc.type, 'APPROVED')}
                        disabled={verifyingDocType === doc.type || doc.status === 'APPROVED'}
                      >
                        <CheckCircle2 size={13} />
                        <span>Verify & Approve</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDocumentVerify(doc.type, 'CORRECTION_NEEDED')}
                        disabled={verifyingDocType === doc.type || doc.status === 'CORRECTION_NEEDED'}
                      >
                        <XCircle size={13} />
                        <span>Reject / Request Fix</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">No documents uploaded by applicant yet.</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment Receipts */}
              <h4 className="text-sm font-bold text-slate-800">Confirmed Payment Records</h4>
              {payments.length > 0 ? (
                payments.map((p) => (
                  <div key={p.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <strong className="text-emerald-900 font-mono text-sm">Receipt #{p.receiptNo}</strong>
                      <span className="badge badge-success">{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>Gross Amount: ৳{p.grossAmount.toLocaleString()}</div>
                      <div>Discount: -৳{p.discountAmount.toLocaleString()}</div>
                      <div>Net Paid: <strong>৳{p.netAmount.toLocaleString()}</strong></div>
                      <div>Paid At: {new Date(p.paidAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500">
                  Admission fee payment pending. The student has not completed simulated fee checkout.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer / Verification Form */}
        <div className="inspection-modal-footer p-5 border-t border-slate-200 bg-slate-50">
          <form onSubmit={handleSaveDecision} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Verification Decision:
                </label>
                <select
                  className="form-input text-xs w-full"
                  value={decisionAction}
                  onChange={(e) => setDecisionAction(e.target.value)}
                  data-testid="inspect-decision-select"
                >
                  <option value="ELIGIBLE">ELIGIBLE (Approve for Class Seat Hold)</option>
                  <option value="APPROVE">APPROVE (Full Admission Acceptance)</option>
                  <option value="REQUEST_CHANGES">REQUEST_CHANGES (Put on Hold / Request Docs)</option>
                  <option value="REJECT">REJECT (Reject & Release Seat)</option>
                </select>
              </div>

              {(decisionAction === 'APPROVE' || decisionAction === 'ENROLL') && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Assigned Section:
                    </label>
                    <input
                      type="text"
                      className="form-input text-xs w-full"
                      value={assignedSection}
                      onChange={(e) => setAssignedSection(e.target.value)}
                      placeholder="e.g. Section A - Padma"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Student Roll / No:
                    </label>
                    <input
                      type="text"
                      className="form-input text-xs w-full"
                      value={enrolledStudentNo}
                      onChange={(e) => setEnrolledStudentNo(e.target.value)}
                      placeholder="e.g. 2027-06-001"
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Admission Officer Note:
              </label>
              <input
                type="text"
                className="form-input text-xs w-full"
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder="e.g. Age criteria verified from birth certificate. Eligible for Class 6 enrollment."
              />
            </div>

            <div className="flex justify-end items-center gap-2 pt-2">
              <button
                type="button"
                className="btn btn-muted btn-sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm flex items-center gap-1.5"
                disabled={isSubmitting}
                data-testid="inspect-save-btn"
              >
                <ShieldCheck size={15} />
                <span>{isSubmitting ? 'Verifying...' : 'Confirm Inspection & Save Decision'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
