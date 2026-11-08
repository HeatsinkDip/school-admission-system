import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { resetServerTimeOffsetForTests } from './api';
import { POLL_INTERVAL_MS, STUDENT_ID_STORAGE_KEY } from './config';
import { STRINGS } from './strings';

const VALID_STUDENT_ID = '20152691234567890';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('School Admission Frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    resetServerTimeOffsetForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates 17-digit Student ID and persists valid ID in localStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/classes')) return jsonResponse([]);
      if (url.endsWith('/me/holds')) return jsonResponse([]);
      return jsonResponse({}, 404);
    });

    render(<App />);

    const input = screen.getByTestId('student-id-input');
    const saveBtn = screen.getByTestId('save-student-id-btn');

    // Invalid (too short)
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(saveBtn);
    expect(screen.getByTestId('student-id-error')).toHaveTextContent(
      STRINGS.studentIdValidationError,
    );
    expect(localStorage.getItem(STUDENT_ID_STORAGE_KEY)).toBeNull();

    // Invalid (contains letters)
    fireEvent.change(input, { target: { value: '2015269123456789a' } });
    fireEvent.click(saveBtn);
    expect(screen.getByTestId('student-id-error')).toHaveTextContent(
      STRINGS.studentIdValidationError,
    );

    // Valid 17-digit registration number
    fireEvent.change(input, { target: { value: VALID_STUDENT_ID } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('active-student-id')).toHaveTextContent(VALID_STUDENT_ID);
    });
    expect(localStorage.getItem(STUDENT_ID_STORAGE_KEY)).toBe(VALID_STUDENT_ID);
  });

  it('flips countdown to EXPIRED when hold expires and disables the Pay button without page reload', async () => {
    vi.useFakeTimers();
    const baseNow = new Date('2026-11-08T12:00:00.000Z').getTime();
    vi.setSystemTime(baseNow);

    localStorage.setItem(STUDENT_ID_STORAGE_KEY, VALID_STUDENT_ID);

    const expiresIso = new Date(baseNow + 3000).toISOString();
    const serverIso = new Date(baseNow).toISOString();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/classes')) {
        return jsonResponse([
          {
            id: 'c_1',
            name: 'Class 6 - Morning Shift',
            totalSeats: 120,
            heldSeats: 1,
            confirmedSeats: 0,
            availableSeats: 119,
          },
        ]);
      }
      if (url.endsWith('/me/holds')) {
        const expiredAlready = Date.now() >= baseNow + 3000;
        return jsonResponse([
          {
            holdId: 'h_1',
            classId: 'c_1',
            className: 'Class 6 - Morning Shift',
            status: expiredAlready ? 'EXPIRED' : 'HELD',
            expiresAt: expiresIso,
            serverTime: new Date(Date.now()).toISOString(),
          },
        ]);
      }
      return jsonResponse({ serverTime: serverIso });
    });

    render(<App />);

    // Flush initial fetch promises
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('focused-hold-status')).toHaveTextContent('HELD');
    expect(screen.getByTestId('focused-hold-countdown')).toHaveTextContent('00:03');
    expect(screen.getByTestId('focused-pay-btn')).not.toBeDisabled();

    // Advance 4 seconds past expiry
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('focused-hold-status')).toHaveTextContent('EXPIRED');
    expect(screen.getByTestId('focused-hold-countdown')).toHaveTextContent('00:00');
    expect(screen.getByTestId('focused-pay-btn')).toBeDisabled();
    expect(screen.getByTestId('pay-btn-h_1')).toBeDisabled();
  });

  it('displays a friendly user-facing message when an API call returns an error code', async () => {
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, VALID_STUDENT_ID);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/classes/c_1/holds') && init?.method === 'POST') {
        return jsonResponse(
          { code: 'SEATS_FULL', message: 'No seats are available in this class.' },
          409,
        );
      }
      if (url.endsWith('/classes')) {
        return jsonResponse([
          {
            id: 'c_1',
            name: 'Class 6 - Morning Shift',
            totalSeats: 50,
            heldSeats: 49,
            confirmedSeats: 0,
            availableSeats: 1,
          },
        ]);
      }
      if (url.endsWith('/me/holds')) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<App />);

    const applyBtn = await screen.findByTestId('apply-btn-c_1');
    fireEvent.click(applyBtn);

    const banner = await screen.findByTestId('error-banner');
    expect(banner).toHaveTextContent(STRINGS.errors.SEATS_FULL);
  });

  it('auto-refreshes class seat counts on the polling interval without reload', async () => {
    vi.useFakeTimers();

    let pollCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/classes')) {
        pollCount += 1;
        const held = pollCount === 1 ? 5 : 18;
        return jsonResponse([
          {
            id: 'c_10',
            name: 'Class 6 - Day Shift',
            totalSeats: 100,
            heldSeats: held,
            confirmedSeats: 10,
            availableSeats: 100 - held - 10,
          },
        ]);
      }
      return jsonResponse([]);
    });

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('class-held-c_10')).toHaveTextContent('5');
    expect(screen.getByTestId('class-available-c_10')).toHaveTextContent('85');

    // Advance by one polling interval
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('class-held-c_10')).toHaveTextContent('18');
    expect(screen.getByTestId('class-available-c_10')).toHaveTextContent('72');
  });
});

