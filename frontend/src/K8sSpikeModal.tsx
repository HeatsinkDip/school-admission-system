import React, { useState, useEffect, useRef } from 'react';
import { Bolt, X } from 'lucide-react';
import { SchoolClass } from './types';
import './K8sModals.css';

interface K8sSpikeModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  onSimulationComplete?: (classId: string, bookedSeats: number) => void;
}

export const K8sSpikeModal: React.FC<K8sSpikeModalProps> = ({
  isOpen,
  onClose,
  classes,
  onSimulationComplete,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || 'CLS-6A');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [podsCount, setPodsCount] = useState<number>(3);
  const [acceptedCount, setAcceptedCount] = useState<number>(0);
  const [rejectedCount, setRejectedCount] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([
    '// Ready. Click "Fire 100 Simultaneous Requests" to observe Kubernetes HPA scaling and First-Come-First-Serve atomic seat locking...',
  ]);

  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (classes.length > 0 && !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) return null;

  const selectedClass = classes.find((c) => c.id === selectedClassId) || {
    id: selectedClassId,
    name: 'Class 6 - Morning Shift',
    totalSeats: 50,
    heldSeats: 0,
    confirmedSeats: 0,
    availableSeats: 50,
  };

  const capacity = selectedClass.totalSeats || 50;

  const runSimulation = () => {
    if (isRunning) return;

    setIsRunning(true);
    setAcceptedCount(0);
    setRejectedCount(0);
    setPodsCount(3);
    setLogs([
      `[K8s Ingress] Incoming burst: 100 concurrent parent checkout requests for ${selectedClass.name} (Capacity: ${capacity} Seats)...`,
      `[K8s HPA] CPU utilization spiked > 65%. Auto-scaling backend pods from 3 to 12 replicas...`,
    ]);

    setTimeout(() => {
      setPodsCount(12);
    }, 400);

    let currentReq = 0;
    let accepted = 0;
    let rejected = 0;

    const interval = window.setInterval(() => {
      for (let i = 0; i < 5; i++) {
        currentReq++;
        const fakeBrn = '20159990000000' + String(currentReq).padStart(3, '0');

        if (accepted < capacity) {
          accepted++;
          if (currentReq % 5 === 0 || accepted === capacity) {
            setLogs((prev) => [
              ...prev,
              `[LOCK ACQUIRED] Req #${currentReq} (BRN: ${fakeBrn}) -> Seat #${accepted}/${capacity} Guaranteed & PDF Issued.`,
            ]);
          }
        } else {
          rejected++;
          if (currentReq === capacity + 1 || currentReq % 10 === 0 || currentReq === 100) {
            setLogs((prev) => [
              ...prev,
              `[REJECTED - CLASS FULL] Req #${currentReq} (BRN: ${fakeBrn}) -> Notified: Batch reached ${capacity}/${capacity} capacity on First-Come-First-Serve basis.`,
            ]);
          }
        }
      }

      setAcceptedCount(accepted);
      setRejectedCount(rejected);

      if (currentReq >= 100) {
        window.clearInterval(interval);
        setIsRunning(false);
        setLogs((prev) => [
          ...prev,
          `[SUMMARY] 100 Simultaneous Requests Handled with Zero Downtime: Exactly ${capacity} seats locked atomically; remaining ${rejected} users safely notified with valid reason.`,
          `[K8s HPA] Traffic stabilized. Scaling down pods to baseline (4 Pods).`,
        ]);
        setTimeout(() => {
          setPodsCount(4);
        }, 2000);
        if (onSimulationComplete) {
          onSimulationComplete(selectedClass.id, accepted);
        }
      }
    }, 120);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="k8s-sim-modal-card"
        onClick={(e) => e.stopPropagation()}
        data-testid="k8s-spike-modal"
      >
        <div className="k8s-sim-header">
          <div className="flex items-center gap-3">
            <div className="k8s-icon-box">
              <Bolt size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="k8s-sim-title">Kubernetes High-Concurrency Seat Burst Simulator</h3>
              <p className="k8s-sim-subtitle">
                Simulating 100 Simultaneous Parent Requests competing for 50 Limited Seats
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="k8s-sim-body">
          {/* Controls Bar */}
          <div className="k8s-sim-controls">
            <div className="k8s-class-picker">
              <label htmlFor="k8s-target-class" className="text-xs text-slate-400 block font-semibold mb-1">
                Target Class (Capped at {capacity} Seats)
              </label>
              <select
                id="k8s-target-class"
                className="input input-sm bg-slate-900 border-slate-700 text-white"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={isRunning}
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.totalSeats} seats)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-warning btn-md font-bold flex items-center gap-2 shrink-0"
              onClick={runSimulation}
              disabled={isRunning}
              data-testid="run-spike-sim-btn"
            >
              <Bolt size={16} className={isRunning ? 'animate-bounce' : ''} />
              <span>{isRunning ? 'Processing 100 Requests...' : 'Fire 100 Simultaneous Requests'}</span>
            </button>
          </div>

          {/* Telemetry Chips */}
          <div className="k8s-telemetry-grid">
            <div className="telemetry-card">
              <span className="telemetry-label">K8s Active Pods</span>
              <span className="telemetry-val text-sky-400 font-mono">
                {podsCount} Pods {podsCount > 3 ? '(HPA Scaled)' : ''}
              </span>
            </div>
            <div className="telemetry-card">
              <span className="telemetry-label">Accepted (Seats Locked)</span>
              <span className="telemetry-val text-emerald-400 font-mono">
                {acceptedCount} / {capacity}
              </span>
            </div>
            <div className="telemetry-card">
              <span className="telemetry-label">Rejected (Class Full Alert)</span>
              <span className="telemetry-val text-rose-400 font-mono">{rejectedCount}</span>
            </div>
          </div>

          {/* Live Terminal Log Stream */}
          <div className="k8s-terminal-box" ref={logBoxRef}>
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`terminal-line ${log.includes('[LOCK ACQUIRED]')
                    ? 'text-emerald-400 font-semibold'
                    : log.includes('[REJECTED')
                      ? 'text-rose-400'
                      : log.includes('[SUMMARY]')
                        ? 'text-amber-300 font-bold'
                        : log.includes('[K8s HPA]')
                          ? 'text-sky-300'
                          : 'text-slate-400'
                  }`}
              >
                {log}
              </div>
            ))}
          </div>

          <div className="k8s-sim-footer">
            <span className="text-xs text-slate-400">
              Technology: PostgreSQL Row Locking (<code className="text-sky-400">SELECT ... FOR UPDATE</code>) + Kubernetes HPA
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close Simulator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
