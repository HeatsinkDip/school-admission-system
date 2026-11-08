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
    window.history.pushState({}, '', '/');
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

  it('secures /admin with password login and opens Admin Console after authentication', async () => {
    window.history.pushState({}, '', '/admin');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/admin/login') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}')) as { password?: string };
        if (body.password === 'admin123') {
          return jsonResponse({
            token: 'tok_admin_123',
            username: 'admin',
            role: 'SUPER_ADMIN',
            fullName: 'Principal / Super Admin',
            expiresAt: '2027-01-01T00:00:00Z',
          });
        }
        return jsonResponse(
          { code: 'INVALID_CREDENTIALS', message: 'Invalid admin username or password.' },
          401,
        );
      }
      if (url.endsWith('/admin/dashboard')) {
        return jsonResponse({
          classes: [],
          totalSeats: 120,
          totalHeld: 2,
          totalConfirmed: 10,
          totalAvailable: 108,
          totalApplications: 12,
          pendingReviews: 1,
          pendingConcessions: 0,
          totalWaitlisted: 0,
          totalRevenueBdt: 440000,
          totalRefundedBdt: 0,
          settings: {
            academicYear: '2027',
            admissionOpensAt: '2026-01-01T00:00:00Z',
            admissionClosesAt: '2027-12-31T23:59:59Z',
            holdDurationSeconds: 600,
            paperworkDeadlineDays: 7,
            waitlistEnabled: true,
            siblingDiscountPercent: 10,
          },
        });
      }
      return jsonResponse([]);
    });

    render(<App />);

    // Should render the Admin Password Login screen at /admin
    expect(screen.getByTestId('admin-login-screen')).toBeInTheDocument();

    const passInput = screen.getByTestId('admin-password-input');
    const loginBtn = screen.getByTestId('admin-login-btn');

    // Wrong password shows error
    fireEvent.change(passInput, { target: { value: 'wrongpass' } });
    fireEvent.click(loginBtn);
    expect(await screen.findByTestId('error-banner')).toHaveTextContent(
      STRINGS.errors.INVALID_CREDENTIALS,
    );

    // Correct password opens Admin Console
    fireEvent.change(passInput, { target: { value: 'admin123' } });
    fireEvent.click(loginBtn);

    expect(await screen.findByTestId('admin-console-view')).toBeInTheDocument();
  });

  it('allows parents on main URL (/) to fill out and save their child information', async () => {
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, VALID_STUDENT_ID);

    let savedPayload: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/parent/profile') && init?.method === 'PUT') {
        savedPayload = JSON.parse(String(init.body || '{}')) as Record<string, unknown>;
        return jsonResponse({
          studentId: VALID_STUDENT_ID,
          fullNameEn: savedPayload.fullNameEn,
          dob: savedPayload.dob,
          presentAddress: savedPayload.presentAddress,
          documents: [],
          applicationStatus: 'DRAFT',
          completenessPercent: 60,
        });
      }
      if (url.endsWith('/classes') || url.endsWith('/me/holds')) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<App />);

    const nameInput = await screen.findByTestId('child-name-en-input');
    fireEvent.change(nameInput, { target: { value: 'Aarav Rahman' } });

    const addressInput = screen.getByTestId('child-address-input');
    fireEvent.change(addressInput, { target: { value: 'Dhanmondi, Dhaka' } });

    fireEvent.click(screen.getByTestId('save-profile-btn'));

    expect(await screen.findByTestId('success-banner')).toHaveTextContent(
      STRINGS.profileSavedSuccess,
    );
    expect(savedPayload).toMatchObject({
      fullNameEn: 'Aarav Rahman',
      presentAddress: 'Dhanmondi, Dhaka',
    });
  });

  it('displays notifications in the NotificationCenter and allows marking them as read', async () => {
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, VALID_STUDENT_ID);

    let markReadCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/notifications')) {
        return jsonResponse({
          unreadCount: markReadCalled ? 0 : 1,
          notifications: [
            {
              id: 101,
              recipientType: 'STUDENT',
              recipientId: VALID_STUDENT_ID,
              category: 'SEAT_HOLD',
              severity: 'WARNING',
              title: 'Temporary Seat Hold Placed',
              message: 'Your hold for Class 6 - Morning Shift expires in 10 minutes.',
              actor: 'System',
              isRead: markReadCalled,
              createdAt: '2026-11-08T18:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/notifications/101/read') && init?.method === 'POST') {
        markReadCalled = true;
        return jsonResponse({ success: true });
      }
      if (url.endsWith('/classes') || url.endsWith('/me/holds')) {
        return jsonResponse([]);
      }
      return jsonResponse({});
    });

    render(<App />);

    // Notification bell should display badge with "1"
    const bellBtn = await screen.findByTestId('notification-bell-btn');
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('1');

    // Click to open notification tray
    fireEvent.click(bellBtn);
    expect(await screen.findByText('Temporary Seat Hold Placed')).toBeInTheDocument();
    expect(screen.getByText('Your hold for Class 6 - Morning Shift expires in 10 minutes.')).toBeInTheDocument();

    // Mark as read by clicking unread notification item
    const notifItem = screen.getByTestId('notif-item-101');
    fireEvent.click(notifItem);

    await waitFor(() => {
      expect(markReadCalled).toBe(true);
    });
  });
});

