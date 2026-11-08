import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiClientError, getServerNowMs } from './api';
import { POLL_INTERVAL_MS, STUDENT_ID_STORAGE_KEY } from './config';
import { STRINGS } from './strings';
import { HoldItem, HoldStatus, SchoolClass } from './types';

export function isValidStudentId(value: string): boolean {
  return /^[0-9]{17}$/.test(value.trim());
}

export function formatRemainingSeconds(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getEffectiveHoldStatus(hold: HoldItem, nowMs: number): HoldStatus {
  if (hold.status === 'HELD') {
    const expiresMs = Date.parse(hold.expiresAt);
    if (!Number.isNaN(expiresMs) && expiresMs <= nowMs) {
      return 'EXPIRED';
    }
  }
  return hold.status;
}

function formatStatusLabel(status: HoldStatus): string {
  switch (status) {
    case 'HELD':
      return STRINGS.statusHeld;
    case 'CONFIRMED':
      return STRINGS.statusConfirmed;
    case 'EXPIRED':
      return STRINGS.statusExpired;
    case 'CANCELLED':
      return STRINGS.statusCancelled;
  }
}

export function App() {
  // --- Persisted Student ID ---
  const [savedStudentId, setSavedStudentId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STUDENT_ID_STORAGE_KEY) || '';
      return isValidStudentId(stored) ? stored.trim() : '';
    } catch {
      return '';
    }
  });
  const [studentIdInput, setStudentIdInput] = useState<string>(savedStudentId);
  const [isEditingStudentId, setIsEditingStudentId] = useState<boolean>(!savedStudentId);
  const [studentIdError, setStudentIdError] = useState<string | null>(null);

  // --- Data State ---
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [myHolds, setMyHolds] = useState<HoldItem[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);

  // --- Create Class Form State ---
  const [newClassName, setNewClassName] = useState('');
  const [newClassSeats, setNewClassSeats] = useState('120');
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // --- In-flight Action States ---
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [confirmingHoldId, setConfirmingHoldId] = useState<string | null>(null);
  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

  // --- Messages / Feedback ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Live Clock Tick (every 1s) ---
  const [nowMs, setNowMs] = useState<number>(() => getServerNowMs());
  const expiredRefetchedIds = useRef<Set<string>>(new Set());

  const showError = useCallback((err: unknown) => {
    setSuccessMessage(null);
    if (err instanceof ApiClientError) {
      setErrorMessage(err.friendlyMessage);
    } else if (err instanceof Error && err.message) {
      setErrorMessage(err.message);
    } else {
      setErrorMessage(STRINGS.errors.UNKNOWN_ERROR);
    }
  }, []);

  // --- Data Fetching ---
  const refreshData = useCallback(
    async (silent = false) => {
      try {
        const classListPromise = api.listClasses();
        const holdsPromise = savedStudentId
          ? api.getMyHolds(savedStudentId)
          : Promise.resolve([] as HoldItem[]);

        const [classList, holds] = await Promise.all([classListPromise, holdsPromise]);
        setClasses(classList);
        setMyHolds(holds);
        setNowMs(getServerNowMs());
      } catch (err) {
        if (!silent) {
          showError(err);
        } else {
          // Even during background polling, surface network errors if we have no data loaded yet
          setErrorMessage((prev) =>
            prev ?? (err instanceof ApiClientError ? err.friendlyMessage : STRINGS.errors.NETWORK_ERROR),
          );
        }
      }
    },
    [savedStudentId, showError],
  );

  // Initial fetch + polling every POLL_INTERVAL_MS
  useEffect(() => {
    void refreshData(true);
    const pollTimer = window.setInterval(() => {
      void refreshData(true);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(pollTimer);
  }, [refreshData]);

  // 1-second countdown ticker
  useEffect(() => {
    const tickTimer = window.setInterval(() => {
      const currentNow = getServerNowMs();
      setNowMs(currentNow);
    }, 1000);
    return () => window.clearInterval(tickTimer);
  }, []);

  // Whenever any HELD application crosses its expiry timestamp locally, trigger an immediate re-fetch once
  useEffect(() => {
    let shouldRefetch = false;
    for (const h of myHolds) {
      if (
        h.status === 'HELD' &&
        Date.parse(h.expiresAt) <= nowMs &&
        !expiredRefetchedIds.current.has(h.holdId)
      ) {
        expiredRefetchedIds.current.add(h.holdId);
        shouldRefetch = true;
      }
    }
    if (shouldRefetch) {
      void refreshData(true);
    }
  }, [myHolds, nowMs, refreshData]);

  // --- Student ID Handlers ---
  const handleSaveStudentId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = studentIdInput.trim();
    if (!isValidStudentId(trimmed)) {
      setStudentIdError(STRINGS.studentIdValidationError);
      return;
    }
    setStudentIdError(null);
    setErrorMessage(null);
    setSavedStudentId(trimmed);
    setIsEditingStudentId(false);
    try {
      localStorage.setItem(STUDENT_ID_STORAGE_KEY, trimmed);
    } catch {
      // ignore storage errors
    }
  };

  const handleChangeStudentId = () => {
    setStudentIdInput(savedStudentId);
    setStudentIdError(null);
    setIsEditingStudentId(true);
  };

  const handleClearStudentId = () => {
    setSavedStudentId('');
    setStudentIdInput('');
    setMyHolds([]);
    setSelectedHoldId(null);
    setStudentIdError(null);
    setIsEditingStudentId(true);
    try {
      localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // --- Admin Create Class Handler ---
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = newClassName.trim();
    if (!trimmedName) {
      setErrorMessage(STRINGS.createClassNameError);
      return;
    }
    const parsedSeats = Number(newClassSeats);
    if (!Number.isInteger(parsedSeats) || parsedSeats <= 0) {
      setErrorMessage(STRINGS.createClassSeatsError);
      return;
    }

    setIsCreatingClass(true);
    try {
      const created = await api.createClass(trimmedName, parsedSeats);
      setNewClassName('');
      setNewClassSeats('120');
      setSuccessMessage(STRINGS.createClassSuccess(created.name, created.totalSeats));
      await refreshData(false);
    } catch (err) {
      showError(err);
    } finally {
      setIsCreatingClass(false);
    }
  };

  // --- Student Actions ---
  const handleApply = async (cls: SchoolClass) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      setIsEditingStudentId(true);
      return;
    }

    setApplyingClassId(cls.id);
    try {
      const createdHold = await api.applyForSeat(cls.id, savedStudentId);
      const enriched: HoldItem = {
        ...createdHold,
        className: createdHold.className || cls.name,
      };
      setMyHolds((prev) => [enriched, ...prev.filter((h) => h.holdId !== enriched.holdId)]);
      setSelectedHoldId(enriched.holdId);
      setSuccessMessage(STRINGS.holdCreatedSuccess(cls.name));
      await refreshData(true);
    } catch (err) {
      showError(err);
      await refreshData(true);
    } finally {
      setApplyingClassId(null);
    }
  };

  const handleConfirmHold = async (hold: HoldItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }

    setConfirmingHoldId(hold.holdId);
    try {
      await api.confirmHold(hold.holdId, savedStudentId);
      setMyHolds((prev) =>
        prev.map((item) =>
          item.holdId === hold.holdId ? { ...item, status: 'CONFIRMED' } : item,
        ),
      );
      setSelectedHoldId(hold.holdId);
      setSuccessMessage(STRINGS.holdConfirmedSuccess);
      await refreshData(true);
    } catch (err) {
      showError(err);
      await refreshData(true);
    } finally {
      setConfirmingHoldId(null);
    }
  };

  const handleCancelHold = async (hold: HoldItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidStudentId(savedStudentId)) {
      setErrorMessage(STRINGS.studentIdValidationError);
      return;
    }

    setCancellingHoldId(hold.holdId);
    try {
      await api.cancelHold(hold.holdId, savedStudentId);
      setMyHolds((prev) =>
        prev.map((item) =>
          item.holdId === hold.holdId ? { ...item, status: 'CANCELLED' } : item,
        ),
      );
      setSuccessMessage(STRINGS.holdCancelledSuccess);
      await refreshData(true);
    } catch (err) {
      showError(err);
      await refreshData(true);
    } finally {
      setCancellingHoldId(null);
    }
  };

  // Map of classId -> active (HELD and unexpired, or CONFIRMED) hold for current student
  const activeHoldByClassId = useMemo(() => {
    const map = new Map<string, HoldItem>();
    for (const h of myHolds) {
      const effective = getEffectiveHoldStatus(h, nowMs);
      if (effective === 'HELD' || effective === 'CONFIRMED') {
        map.set(h.classId, h);
      }
    }
    return map;
  }, [myHolds, nowMs]);

  // Focused application for the "Application View" panel
  const focusedHold = useMemo(() => {
    if (selectedHoldId) {
      const found = myHolds.find((h) => h.holdId === selectedHoldId);
      if (found) return found;
    }
    return myHolds[0] || null;
  }, [myHolds, selectedHoldId]);

  const classNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.id, c.name);
    }
    return map;
  }, [classes]);

  return (
    <div className="container">
      <header className="header">
        <h1>{STRINGS.appTitle}</h1>
        <p className="subtitle">{STRINGS.appSubtitle}</p>
      </header>

      {/* --- Top Student ID Bar --- */}
      <section className="card student-bar" data-testid="student-id-section">
        {!isEditingStudentId && savedStudentId ? (
          <div className="student-active-bar">
            <div>
              <span className="student-badge-label">{STRINGS.applyingAsPrefix}</span>{' '}
              <strong data-testid="active-student-id" className="mono">
                {savedStudentId}
              </strong>
            </div>
            <div className="button-group">
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="change-student-id-btn"
                onClick={handleChangeStudentId}
              >
                {STRINGS.studentIdChangeButton}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                data-testid="clear-student-id-btn"
                onClick={handleClearStudentId}
              >
                {STRINGS.studentIdClearButton}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveStudentId} className="student-form" noValidate>
            <label htmlFor="student-id-input" className="form-label">
              {STRINGS.studentIdLabel}
            </label>
            <div className="input-row">
              <input
                id="student-id-input"
                data-testid="student-id-input"
                type="text"
                inputMode="numeric"
                maxLength={17}
                className="input mono"
                placeholder={STRINGS.studentIdPlaceholder}
                value={studentIdInput}
                onChange={(e) => {
                  setStudentIdInput(e.target.value);
                  if (studentIdError) setStudentIdError(null);
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                data-testid="save-student-id-btn"
              >
                {STRINGS.studentIdSaveButton}
              </button>
            </div>
            {studentIdError && (
              <p className="field-error" role="alert" data-testid="student-id-error">
                {studentIdError}
              </p>
            )}
            {!savedStudentId && !studentIdError && (
              <p className="hint-text">{STRINGS.studentIdRequiredHint}</p>
            )}
          </form>
        )}
      </section>

      {/* --- Alert Banners --- */}
      {errorMessage && (
        <div className="alert alert-error" role="alert" data-testid="error-banner">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setErrorMessage(null)}
            aria-label={STRINGS.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="status" data-testid="success-banner">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label={STRINGS.dismissButton}
          >
            ×
          </button>
        </div>
      )}

      {/* --- School Admin: Create Class --- */}
      <section className="card" data-testid="create-class-section">
        <h2>{STRINGS.adminSectionTitle}</h2>
        <form onSubmit={handleCreateClass} className="create-class-form" noValidate>
          <div className="form-field">
            <label htmlFor="class-name-input" className="form-label">
              {STRINGS.classNameLabel}
            </label>
            <input
              id="class-name-input"
              data-testid="class-name-input"
              type="text"
              className="input"
              placeholder={STRINGS.classNamePlaceholder}
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              disabled={isCreatingClass}
            />
          </div>
          <div className="form-field seats-field">
            <label htmlFor="total-seats-input" className="form-label">
              {STRINGS.totalSeatsLabel}
            </label>
            <input
              id="total-seats-input"
              data-testid="total-seats-input"
              type="number"
              min={1}
              step={1}
              className="input"
              placeholder={STRINGS.totalSeatsPlaceholder}
              value={newClassSeats}
              onChange={(e) => setNewClassSeats(e.target.value)}
              disabled={isCreatingClass}
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              data-testid="create-class-btn"
              disabled={isCreatingClass}
            >
              {isCreatingClass ? STRINGS.creatingClassButton : STRINGS.createClassButton}
            </button>
          </div>
        </form>
      </section>

      {/* --- Class List --- */}
      <section className="card" data-testid="class-list-section">
        <div className="section-header">
          <h2>{STRINGS.classesSectionTitle}</h2>
          <span className="hint-text">{STRINGS.classesAutoRefreshNote}</span>
        </div>

        {classes.length === 0 ? (
          <p className="empty-state" data-testid="no-classes-message">
            {STRINGS.noClassesYet}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table" data-testid="classes-table">
              <thead>
                <tr>
                  <th>{STRINGS.colClassName}</th>
                  <th>{STRINGS.colTotalSeats}</th>
                  <th>{STRINGS.colHeldSeats}</th>
                  <th>{STRINGS.colConfirmedSeats}</th>
                  <th>{STRINGS.colAvailableSeats}</th>
                  <th>{STRINGS.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => {
                  const isApplyingThis = applyingClassId === cls.id;
                  const noStudent = !isValidStudentId(savedStudentId);
                  const noSeats = cls.availableSeats <= 0;
                  const existingActive = activeHoldByClassId.get(cls.id);

                  let disabledReason: string | null = null;
                  if (noStudent) {
                    disabledReason = STRINGS.applyDisabledNoStudent;
                  } else if (existingActive) {
                    disabledReason = STRINGS.applyDisabledAlreadyActive;
                  } else if (noSeats) {
                    disabledReason = STRINGS.applyDisabledFull;
                  }

                  const isDisabled = isApplyingThis || Boolean(disabledReason);

                  return (
                    <tr key={cls.id} data-testid={`class-row-${cls.id}`}>
                      <td data-testid={`class-name-${cls.id}`}>
                        <strong>{cls.name}</strong>
                      </td>
                      <td data-testid={`class-total-${cls.id}`}>{cls.totalSeats}</td>
                      <td data-testid={`class-held-${cls.id}`}>{cls.heldSeats}</td>
                      <td data-testid={`class-confirmed-${cls.id}`}>{cls.confirmedSeats}</td>
                      <td data-testid={`class-available-${cls.id}`}>
                        <span
                          className={
                            cls.availableSeats > 0 ? 'seat-pill seat-open' : 'seat-pill seat-full'
                          }
                        >
                          {cls.availableSeats}
                        </span>
                      </td>
                      <td>
                        <div className="action-cell">
                          <button
                            type="button"
                            className="btn btn-primary"
                            data-testid={`apply-btn-${cls.id}`}
                            disabled={isDisabled}
                            onClick={() => void handleApply(cls)}
                          >
                            {isApplyingThis ? STRINGS.applyingButton : STRINGS.applyButton}
                          </button>
                          {disabledReason && (
                            <span
                              className="disabled-reason"
                              data-testid={`apply-reason-${cls.id}`}
                            >
                              {disabledReason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Active / Focused Application View --- */}
      {savedStudentId && focusedHold && (
        <section className="card highlight-card" data-testid="active-application-section">
          <h2>{STRINGS.activeApplicationTitle}</h2>
          {(() => {
            const effectiveStatus = getEffectiveHoldStatus(focusedHold, nowMs);
            const remainingSec = Math.max(
              0,
              (Date.parse(focusedHold.expiresAt) - nowMs) / 1000,
            );
            const canPay =
              effectiveStatus === 'HELD' &&
              remainingSec > 0 &&
              confirmingHoldId !== focusedHold.holdId &&
              cancellingHoldId !== focusedHold.holdId;
            const canCancel =
              effectiveStatus === 'HELD' &&
              remainingSec > 0 &&
              cancellingHoldId !== focusedHold.holdId &&
              confirmingHoldId !== focusedHold.holdId;

            return (
              <div className="application-detail" data-testid="focused-hold-card">
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">{STRINGS.classLabel}:</span>{' '}
                    <strong>
                      {focusedHold.className ||
                        classNamesById.get(focusedHold.classId) ||
                        focusedHold.classId}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.holdIdLabel}:</span>{' '}
                    <span className="mono">{focusedHold.holdId}</span>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.statusLabel}:</span>{' '}
                    <span
                      className={`status-badge status-${effectiveStatus.toLowerCase()}`}
                      data-testid="focused-hold-status"
                    >
                      {effectiveStatus}
                    </span>{' '}
                    <span className="hint-text">({formatStatusLabel(effectiveStatus)})</span>
                  </div>
                  <div>
                    <span className="detail-label">{STRINGS.timeRemainingLabel}:</span>{' '}
                    {effectiveStatus === 'HELD' ? (
                      <strong className="countdown mono" data-testid="focused-hold-countdown">
                        {formatRemainingSeconds(remainingSec)}
                      </strong>
                    ) : (
                      <span className="mono" data-testid="focused-hold-countdown">
                        00:00
                      </span>
                    )}
                  </div>
                </div>

                {effectiveStatus === 'EXPIRED' && (
                  <p className="status-note expired-note" data-testid="focused-expired-notice">
                    {STRINGS.expiredNotice}
                  </p>
                )}
                {effectiveStatus === 'CONFIRMED' && (
                  <p className="status-note confirmed-note">{STRINGS.confirmedNotice}</p>
                )}
                {effectiveStatus === 'CANCELLED' && (
                  <p className="status-note">{STRINGS.cancelledNotice}</p>
                )}

                <div className="button-group">
                  <button
                    type="button"
                    className="btn btn-success"
                    data-testid="focused-pay-btn"
                    disabled={!canPay}
                    onClick={() => void handleConfirmHold(focusedHold)}
                  >
                    {confirmingHoldId === focusedHold.holdId
                      ? STRINGS.payingFeeButton
                      : STRINGS.payFeeButton}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    data-testid="focused-cancel-btn"
                    disabled={!canCancel}
                    onClick={() => void handleCancelHold(focusedHold)}
                  >
                    {cancellingHoldId === focusedHold.holdId
                      ? STRINGS.cancellingHoldButton
                      : STRINGS.cancelHoldButton}
                  </button>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* --- My Applications List --- */}
      <section className="card" data-testid="my-applications-section">
        <h2>{STRINGS.myApplicationsTitle}</h2>
        {!savedStudentId ? (
          <p className="empty-state">{STRINGS.studentIdRequiredHint}</p>
        ) : myHolds.length === 0 ? (
          <p className="empty-state" data-testid="no-applications-message">
            {STRINGS.noApplicationsYet}
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table" data-testid="my-holds-table">
              <thead>
                <tr>
                  <th>{STRINGS.holdIdLabel}</th>
                  <th>{STRINGS.classLabel}</th>
                  <th>{STRINGS.statusLabel}</th>
                  <th>{STRINGS.timeRemainingLabel}</th>
                  <th>{STRINGS.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {myHolds.map((hold) => {
                  const effectiveStatus = getEffectiveHoldStatus(hold, nowMs);
                  const remainingSec = Math.max(
                    0,
                    (Date.parse(hold.expiresAt) - nowMs) / 1000,
                  );
                  const canPay =
                    effectiveStatus === 'HELD' &&
                    remainingSec > 0 &&
                    confirmingHoldId !== hold.holdId &&
                    cancellingHoldId !== hold.holdId;
                  const canCancel =
                    effectiveStatus === 'HELD' &&
                    remainingSec > 0 &&
                    cancellingHoldId !== hold.holdId &&
                    confirmingHoldId !== hold.holdId;

                  return (
                    <tr
                      key={hold.holdId}
                      data-testid={`hold-row-${hold.holdId}`}
                      onClick={() => setSelectedHoldId(hold.holdId)}
                    >
                      <td className="mono">{hold.holdId}</td>
                      <td>
                        {hold.className || classNamesById.get(hold.classId) || hold.classId}
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${effectiveStatus.toLowerCase()}`}
                          data-testid={`hold-status-${hold.holdId}`}
                        >
                          {effectiveStatus}
                        </span>
                      </td>
                      <td className="mono" data-testid={`hold-countdown-${hold.holdId}`}>
                        {effectiveStatus === 'HELD'
                          ? formatRemainingSeconds(remainingSec)
                          : '00:00'}
                      </td>
                      <td>
                        <div className="button-group">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            data-testid={`pay-btn-${hold.holdId}`}
                            disabled={!canPay}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleConfirmHold(hold);
                            }}
                          >
                            {confirmingHoldId === hold.holdId
                              ? STRINGS.payingFeeButton
                              : STRINGS.payFeeButton}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            data-testid={`cancel-btn-${hold.holdId}`}
                            disabled={!canCancel}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCancelHold(hold);
                            }}
                          >
                            {cancellingHoldId === hold.holdId
                              ? STRINGS.cancellingHoldButton
                              : STRINGS.cancelHoldButton}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

