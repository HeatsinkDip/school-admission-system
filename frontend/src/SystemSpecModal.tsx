import React from 'react';
import { FileCode2, X, ShieldCheck, Database, Layers, CheckCircle2, AlertOctagon } from 'lucide-react';
import './K8sModals.css';

interface SystemSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemSpecModal: React.FC<SystemSpecModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="k8s-sim-modal-card max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="system-spec-modal"
      >
        {/* Header */}
        <div className="k8s-sim-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <FileCode2 size={22} />
            </div>
            <div>
              <h3 className="k8s-sim-title">README.md — System Architecture & Workflow Specification</h3>
              <p className="k8s-sim-subtitle">
                Onnorokom Projukti School Admission & High-Concurrency Kubernetes Blueprint
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="k8s-sim-body overflow-y-auto space-y-6 text-sm text-slate-300 leading-relaxed font-sans pr-2">
          {/* Section 1 */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-display font-bold text-base mb-2">
              <Database size={18} />
              <h4>1. Database Schema & Primary Key Enforcement</h4>
            </div>
            <p className="text-slate-300 mb-3">
              Every applicant record in the school database uses the 17-digit official{' '}
              <strong className="text-white"><code>birth_registration_number</code></strong> as the immutable{' '}
              <strong className="text-white">Primary Key (PK)</strong>. Extraneous fields are stripped from the fast-lane
              hold pipeline to maintain high throughput during opening seconds:
            </p>
            <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
{`PRIMARY KEY (birth_registration_number: VARCHAR(17))
FIELDS:
  • birth_registration_number (PK, Mandatory 17-digit string)
  • student_name (VARCHAR(150), Mandatory)
  • date_of_birth (DATE, Cutoff age validated)
  • parent_name, parent_phone (VARCHAR(20), Verified contact)
  • status [PENDING | ELIGIBLE | ENROLLED | REJECTED]
  • enrolled_class_id (FK -> classes.id)
  • receipt_id (UUID, Cryptographic Verification Hash)
  • payment_timestamp (TIMESTAMPTZ)`}
            </pre>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-display font-bold text-base mb-2">
              <CheckCircle2 size={18} />
              <h4>2. End-to-End Admission Workflow</h4>
            </div>
            <ol className="list-decimal list-inside space-y-2.5 text-slate-300">
              <li>
                <strong className="text-white">Parent Registration:</strong> Parent submits complete child information
                with mandatory 17-digit Birth Registration Number. Initial state is set to <code className="text-amber-300">PENDING</code>.
              </li>
              <li>
                <strong className="text-white">Admission Office Verification:</strong> Admission Officers inspect original documents
                via modal review and confirm eligibility (<code className="text-emerald-400">ELIGIBLE</code>) or issue remarks.
              </li>
              <li>
                <strong className="text-white">Dynamic Class Visibility:</strong> Once verified as <code className="text-emerald-400">ELIGIBLE</code>,
                the student portal unlocks class options created by the Admin (Class 6 Morning/Day, Class 7, Class 8) along with their live seat matrix.
              </li>
              <li>
                <strong className="text-white">Atomic Fast-Lane Hold & Payment:</strong> User claims a 10-minute pessimistic hold.
                Upon payment confirmation, the seat is permanently guaranteed, status flips to <code className="text-emerald-400">ENROLLED</code>,
                and an official verifiable PDF receipt is generated instantly.
              </li>
              <li>
                <strong className="text-white">Race-Condition Failure Notification:</strong> If a class sells out before another parent
                finalizes checkout, the system rejects the request gracefully with code <code className="text-rose-400">SEATS_FULL</code> and
                displays an actionable modal alert explaining the exact reason.
              </li>
            </ol>
          </div>

          {/* Section 3 */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-display font-bold text-base mb-2">
              <Layers size={18} />
              <h4>3. Kubernetes (K8s) Horizontal Pod Auto-Scaling (HPA)</h4>
            </div>
            <p className="text-slate-300 mb-3">
              During peak admission windows when 100+ parents attempt simultaneous checkout for 50 limited seats,
              the Kubernetes cluster automatically scales backend replicas based on real-time CPU and request velocity:
            </p>
            <pre className="bg-slate-900 text-amber-300 p-3.5 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800">
{`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: onnorokom-admission-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: onnorokom-backend-api
  minReplicas: 3
  maxReplicas: 16
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 65
---
# Pessimistic Locking & Atomic Seat Reservation:
SELECT id, total_seats, held_seats, confirmed_seats
FROM classes
WHERE id = @ClassId
FOR UPDATE; -- Prevents phantom reads and over-subscription under high concurrency`}
            </pre>
          </div>

          {/* Section 4 */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 text-sky-400 font-display font-bold text-base mb-2">
              <ShieldCheck size={18} />
              <h4>4. Single Admission Rule & Shift Conflict Prevention</h4>
            </div>
            <p className="text-slate-300">
              The system strictly enforces that a student with the same 17-digit birth registration number cannot hold
              or confirm seats in Morning and Day shifts simultaneously, nor enroll in two different classes at the same time.
              PostgreSQL advisory locks guarantee zero race conditions between concurrent requests for the same student ID.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="k8s-sim-footer shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertOctagon size={14} className="text-emerald-400" />
            <span>Strict First-Come-First-Served Cloud Policy • Zero Overbooking Guarantee</span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Back to Application
          </button>
        </div>
      </div>
    </div>
  );
};

