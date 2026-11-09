# AI Usage Report (`AI_USAGE.md`)

## 1. AI Tools Used
- **Google Gemini (Antigravity IDE Assistant)**: Used for pair-programming, React TypeScript UI scaffolding, xUnit/Vitest test generation, and Docker configuration review.

---

## 2. Parts Where AI Was Used
1. **Backend Boilerplate & SQL Scaffolding (`backend/SchoolAdmission.Api`)**:
   - Drafting DTO contracts matching the 8 required endpoints in §1.4 (`POST /classes`, `GET /classes`, `GET /classes/{classId}`, `POST /classes/{classId}/holds`, `GET /holds/{holdId}`, `POST /holds/{holdId}/confirm`, `DELETE /holds/{holdId}`, `GET /me/holds`).
   - Writing raw `Npgsql` queries and background expiration sweepers (`HoldExpirySweeper.cs`).
2. **Frontend UI & State Management (`frontend/src`)**:
   - Designing the Landing Page, Parent Portal (login/logout, multi-child family switcher, live countdown timer, weekly class routine calendar), and Admin Console (`/admin`).
   - Implementing client-side PDF admission receipt generation (`ReceiptPdf.ts`).
3. **Automated Tests (`backend/SchoolAdmission.Tests` & `frontend/src/App.test.tsx`)**:
   - Scaffolding concurrency burst tests (100 simultaneous requests for limited seats, multi-instance tests) and React Testing Library UI tests.

---

## 3. Where AI Made Mistakes & How I Caught and Fixed Them

### Mistake 1: In-Memory Locking (`SemaphoreSlim`) Instead of PostgreSQL Row Locking
- **What AI did wrong**: Initially, AI suggested using a C# `SemaphoreSlim` in `HoldService` to serialize concurrent seat hold requests.
- **How I caught it**: While testing **Bonus §1.6** (running two backend processes on ports `8080` and `8081` sharing the same PostgreSQL database), I realized an in-memory lock only synchronizes threads within a single process. Across two processes, both instances read the same available seat count simultaneously and overbooked `held + confirmed > totalSeats`.
- **How I fixed it**: Replaced in-memory locking with PostgreSQL row-level pessimistic locking (`SELECT name, total_seats, status FROM classes WHERE id = @id FOR UPDATE`) inside a database transaction, paired with a partial unique index `CREATE UNIQUE INDEX ux_holds_active_student_class ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED')`. Verified by running a multi-process concurrency test firing parallel requests across two independent backend hosts against the same database.

### Mistake 2: Using `.NET` `DateTime.UtcNow` Instead of Database `clock_timestamp()`
- **What AI did wrong**: AI initially compared `expires_at` against a C# `DateTimeOffset.UtcNow` parameter passed from the application layer, and used PostgreSQL `now()` (which returns transaction start time rather than real-time wall clock after acquiring a row lock).
- **How I caught it**: In integration tests where 50 requests queued behind `SELECT ... FOR UPDATE` and `HOLD_DURATION_SECONDS` was set to 2 seconds, `now()` evaluated to the timestamp *before* the lock wait rather than *after* the lock was acquired, causing timing edge cases on seat release.
- **How I fixed it**: Switched all expiry materialization queries inside `HoldService` to use PostgreSQL's `clock_timestamp()` after acquiring the row lock, ensuring exact wall-clock evaluation at the moment the lock is held.

### Mistake 3: Stale Student Name & Profile State When Changing Birth Registration Number
- **What AI did wrong**: In `ParentPortal.tsx`, when a parent changed the 17-digit Birth Registration Number (`X-Student-Id`) to a new number that had no existing profile on the backend (404 response), the `catch` block kept the previous student's `profileForm` state in React memory and used a hardcoded fallback name.
- **How I caught it**: During manual UI testing, changing the Birth Registration Number kept displaying the previous student's name instead of resetting to `null` / empty for the new student ID.
- **How I fixed it**: Updated the `savedStudentId` effect and login/change-ID handlers to immediately clear `profile` (`null`) and reset `profileForm` fields (`fullNameEn: ''`) whenever the Birth Registration Number changes or returns 404, and removed hardcoded demo name fallbacks.

