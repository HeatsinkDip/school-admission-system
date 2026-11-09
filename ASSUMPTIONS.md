# Assumptions & Architectural Design Decisions

Where the specification left details open, the following choices were made and implemented across the backend, frontend, database, and test suite for **Onnorokom Projukti School**.

---

## 1. School Branding & Landing Page Architecture

1. **School Branding:**
   - The school is officially named **Onnorokom Projukti School**, an institution emphasizing scientific inquiry, modern STEM learning, and merit-based transparency.
2. **Landing Page (`/`):**
   - The school web application features a comprehensive public landing page highlighting admission session dates, curriculum pillars, capacity statistics, and entry gates for both guardians (**"Apply for Admission"**) and school administrators (**"Staff / Admin Login"**).
   - In the Parent Portal, parents can toggle between the School Overview landing page and their active admission application workbench via the sidebar.

---

## 2. Parent Workflow & The Eligibility Gate

1. **Mandatory 17-Digit Birth Registration Number (`X-Student-Id`):**
   - In Bangladesh, school admissions uniquely identify applicants using the government-issued 17-digit Birth Registration Number.
   - The system strictly enforces the regex `^[0-9]{17}$` across both frontend form inputs and backend API headers.
2. **Mandatory Profile Fields Gate Before Seat Selection:**
   - In accordance with school regulations, parents must fill out basic student identification (17-digit birth registration number, student name, DOB, gender, at least one guardian name and phone number, and present address) before class seat reservations can be placed.
   - The UI disables class application until mandatory fields are filled, providing clear visual guidance to complete the child's dossier first.
3. **Single Admission Per Student Rule (Multi-Class / Shift Conflict):**
   - The same student (17-digit birth registration number) cannot enter Class 6 Morning Shift and Day Shift simultaneously, nor attend two different classes at the same time.
   - Race conditions across simultaneous class requests are prevented via PostgreSQL per-student transaction advisory locks (`SELECT pg_advisory_xact_lock('student_hold'::regclass::oid::int, hashtext(@studentId));`).
   - If a student has an active `HELD` or `CONFIRMED` admission in any other class, the application returns `409 Conflict: ALREADY_ADMITTED_ELSEWHERE`.
   - In the UI, other classes display an "Already admitted/held" indicator, preventing duplicate shift reservations while allowing seamless shift switching once an unpaid hold is cancelled.
4. **Fast Lane vs. Slow Lane Separation:**
   - **Fast Lane (Seconds):** Hold seat and confirm admission fee once profile prerequisites are met.
   - **Slow Lane (Days):** Complete extensive child biographical records, guardian NID uploads, household income verification, and need-based concession reviews.
5. **Admission Office Eligibility Verification Gate:**
   - After submitting their profile, student applications are set to `SUBMITTED`.
   - The Admission Office inspects the student's age, documents, and previous academic records and transitions the application to `ELIGIBLE` / `APPROVED`.
   - The Parent Portal's class selection view displays an **Eligibility Review Gate**: class-shift enrollment is unlocked once the student's eligibility is approved, preventing unqualified applicants from holding seats.

---

## 3. Class Routines & Fixed Operating Hours Architecture

1. **Fixed Shift Hours:**
   - Morning Shift: 07:30 to 12:00
   - Day Shift: 12:30 to 17:00
   - Evening Shift: 14:30 to 18:30
2. **Weekly Timetable Generator:**
   - Each class automatically receives a standard weekly routine covering Sunday through Thursday with six 45-minute academic periods, morning assembly, teacher and classroom allocations, and a designated 30-minute recess/tiffin break.
3. **Routine Customization & Conflict Prevention:**
   - Administrators can update or reset routine periods via `/admin/classes/{id}/routine`. Overlapping period timings on the same day are validated and rejected server-side (`400 Validation Error`).

---

## 4. High-Concurrency Seat Allocation (100+ Users for 50 Seats)

1. **First-Come, First-Served Concurrency Model:**
   - No lottery system is used. The first applicant to acquire a hold receives the seat.
2. **Pessimistic Database Row Locking (`SELECT ... FOR UPDATE`):**
   - In `HoldService.cs`, hold requests execute inside a raw SQL transaction acquiring an exclusive lock on the target class row:
     ```sql
     SELECT id, total_seats FROM classes WHERE id = @classId FOR UPDATE;
     ```
   - Even when 100+ concurrent requests hit the backend across multiple containers or Kubernetes pods, PostgreSQL serializes the seat check and insertion.
   - The first 50 transactions succeed (`201 Created`).
   - The 51st transaction sees `availableSeats == 0`, rolls back, and returns `409 Conflict: SEATS_FULL`.
3. **Partial Unique Index Safety Net:**
   - `CREATE UNIQUE INDEX ux_holds_active_student_class ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED');` ensures no student holds two seats in the same class.
4. **PostgreSQL as the Single Source of Truth for Time:**
   - Expiration checks use `clock_timestamp()` from PostgreSQL, ensuring immunity to server clock drift across distributed backend replicas.

---

## 4. Payment Simulation & Guaranteed Official PDF Receipts

1. **Payment Simulation:**
   - Clicking "Pay admission fee" executes an immediate simulated transaction (`MOCK_GATEWAY`).
   - Atomically transitions hold status to `CONFIRMED`, marks the seat as permanently guaranteed, and generates an official voucher `RCP-<year>-<id>`.
2. **Downloadable / Printable Official PDF Receipt:**
   - Implemented via `ReceiptPdf.ts`. Formats an A4 admission voucher complete with Onnorokom Projukti School header, watermark seal, child 17-digit registration number, itemized fee schedule (gross total, sibling concession discount, net paid), and registrar certification.
3. **Action Alert Modals:**
   - Key user actions (seat hold created, payment confirmed, class capacity reached, hold expired, profile submitted) trigger informative modal alerts with real-time countdown timers and recovery paths.

---

## 5. Admin Console & Full CRUD Controls

1. **Security & Authentication:**
   - `/admin` is protected by password authentication backed by server-side sessions in PostgreSQL (`admin_sessions`).
   - Pre-seeded staff accounts:
     - `admin` / `admin123` (Super Admin)
     - `officer` / `officer123` (Admission Officer)
     - `accountant` / `accountant123` (Accountant)
2. **Full CRUD via UI:**
   - **Classes:** Create new classes, update seat counts and age rules, delete classes (deletions are rejected if confirmed seats exist to safeguard enrolled students).
   - **Applications:** Read application queue, update dossier fields, verify documents, assign sections/rolls, or delete rejected/abandoned drafts.
   - **Alerts / Notifications:** Read, acknowledge, and delete broadcast notices from the feed.

---

## 6. Kubernetes (K8s) Scalability

1. **Horizontal Pod Autoscaling (HPA):**
   - High admission burst periods (e.g., 10:00 AM rush) are handled by a multi-replica backend deployment configured with an HPA (`k8s/hpa.yaml`) scaling from 3 to 15 pods.
2. **Connection Pooling:**
   - Npgsql connection pool configured with minimum 10 and maximum 100 connections per pod to ensure high throughput without connection pool exhaustion.
