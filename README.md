# Onnorokom School, Bangladesh — Online Admission System

## Project Description

A high-concurrency, First-Come, First-Served (FCFS) online school admission platform built for **Onnorokom School, Bangladesh** (Tejgaon, Dhaka). During peak admission openings, hundreds of parents compete simultaneously for limited seats across class shifts (such as `Class 6 - Morning Shift` and `Class 6 - Day Shift`). Without lottery draws or race conditions, this system allocates temporary 10-minute seat holds, validates student identities via government 17-digit Birth Registration Numbers (BRN), processes fee confirmation idempotently, and automatically returns unpaid seats to the public pool when the hold window expires.

The platform is built with **ASP.NET Core 8 (.NET 8 Minimal APIs)**, **PostgreSQL 16**, **React 18 (Vite + TypeScript)**, and **Docker Compose**, with frontend static hosting support on **Firebase Hosting**.

---

## Service URLs & Access Points

| Service | Environment | URL | Notes |
|---|---|---|---|
| **Web Portal (Public & Parent)** | Docker Compose | [http://localhost:3000](http://localhost:3000) | Landing page, parent login, and parent portal |
| **Admin Console** | Docker Compose | [http://localhost:3000/admin](http://localhost:3000/admin) | Password-protected staff console |
| **Backend REST API** | Docker Compose | [http://localhost:8080](http://localhost:8080) | .NET 8 Minimal API JSON service |
| **Secondary API Instance** | Docker `--profile multi` | [http://localhost:8081](http://localhost:8081) | Shared-DB concurrency replica |
| **PostgreSQL 16** | Docker Compose | `localhost:5432` | DB: `school_admission` (`school_admin` / `school_pass`) |
| **Firebase Hosting** | Production | [https://onnorokom-school-admissions.web.app](https://onnorokom-school-admissions.web.app) | Hosted frontend bundle |

---

## Engineering Approach & Architecture

1. **Database-First Concurrency Control (Zero Overselling):**
   All seat allocation invariants are enforced inside PostgreSQL transactions rather than in-memory locks (`lock`, `SemaphoreSlim`), allowing multiple backend processes (for example ports `8080` and `8081`) to share a single database safely. When applying for a hold (`POST /classes/{classId}/holds`), the API acquires a per-student transaction advisory lock (`pg_advisory_xact_lock`) followed by a pessimistic row lock (`SELECT ... FOR UPDATE`) on the target class row. A partial unique index (`ux_holds_active_student_class`) provides an additional database-level safeguard against duplicate active holds or confirmations.

2. **Query-Time Expiration Using Database Clock:**
   Hold expiration is evaluated against PostgreSQL's server clock (`now()` / `clock_timestamp()`). Both `GET /classes` and `POST /classes/{classId}/holds` filter active holds with `expires_at > now()`, so expired seats become immediately available without waiting for an external scheduler. A lightweight hosted background service (`HoldExpirySweeper`) periodically transitions expired rows to `EXPIRED` for storage hygiene.

3. **Idempotent Fee Confirmation & Atomic Audit Trail:**
   Confirming a hold (`POST /holds/{holdId}/confirm`) locks the hold row (`FOR UPDATE`), verifies ownership via `X-Student-Id`, checks expiration, updates status to `CONFIRMED`, and records an entry in `payments` (`ON CONFLICT (hold_id) DO NOTHING`). Repeated confirmation calls return `200 OK` without double-counting `confirmedSeats` or creating duplicate receipts.

4. **Strict Separation of Public vs. Authenticated Data:**
   Unauthenticated visitors can view only the institutional Landing Page and Login view (`/`). Student dossiers, seat booking actions, routines, fee schedules, and the portal navigation sidebar remain hidden until parent login completes. Staff administration at `/admin` is hidden from public navigation and always requires password login.

Detailed architectural diagrams, ER schemas, state transitions, and design rationales are documented in [ASSUMPTIONS.md](./ASSUMPTIONS.md).

---

## Core Features

### Parent & Applicant Portal
- **Dual Authentication Flow:** Sign in using 17-digit Birth Registration Number (`^[0-9]{17}$`) + parent mobile phone, or via Firebase Google Sign-In followed by mandatory 17-digit BRN and phone linking.
- **Unified Multi-Child Family Account:** Register multiple children under the same guardian account and qualify for an automatic 10% sibling concession on admission charges.
- **Step-by-Step Admission Dossier:** Capture student personal details, guardian NIDs/contacts, and required document uploads before placing a seat hold.
- **Live Hold Countdown & Instant Recovery:** Real-time countdown synchronized with server time transitions cleanly to `EXPIRED` in the UI without a page reload when time runs out, and active holds survive browser refreshes.
- **Single Admission Rule Enforcement:** Prevents a student from holding or confirming multiple seats simultaneously across different classes or shifts (returning `409 Conflict` with clear user feedback); parents can cancel an unpaid hold at any time to switch shifts.
- **PDF Receipt Generation & Admissions Desk Bot:** Generates downloadable printable receipts upon confirmation and provides an interactive FAQ/guidance modal for admissions queries.

### Staff & Admin Console (`/admin`)
- **Password-Protected Role Access:** Supports three roles backed by salted SHA-256 credentials (`admin` / `admin123`, `officer` / `officer123`, `accountant` / `accountant123`, or custom `ADMIN_PASSWORD` env override).
- **Class & Shift Management:** Create, edit, open/close, and configure fee components (`admissionFee`, `sessionCharge`, `developmentFee`, `securityDeposit`, `firstMonthTuition`) per class shift, and delete empty classes safely.
- **Per-Class Student Roster ("View Students"):** View applicants, active holds, and enrolled students for each specific class shift directly from the class table.
- **Application Review & Finance Controls:** Search/filter applicant dossiers, verify uploaded documents, approve/reject sibling concessions, process fee refunds, manage waitlists, configure weekly class routines, and inspect immutable audit logs.

---

## Step-by-Step Admission & Operations Workflow

1. **Start the Stack:** Run `docker compose up --build` and wait for `db`, `backend`, and `frontend` health checks to turn green.
2. **Admin Class Setup (Optional / Staff Flow):**
   - Navigate to `http://localhost:3000/admin` and sign in (`admin` / `admin123`).
   - Create or manage class shifts (e.g., `Class 6 - Morning Shift` with `120` seats) and review fee schedules or weekly routines.
3. **Parent Login & Profile Linking:**
   - Open `http://localhost:3000` and click **Apply for Admission** (or navigate to Parent Login).
   - Sign in with a 17-digit BRN (e.g., `20152691234567890`) and parent mobile phone (`01712345678`), or authenticate via Google and link the child's 17-digit BRN and guardian phone.
4. **Complete Child Dossier:** Fill out child details, guardian information, and document uploads in the Student Dossier tab and save/submit.
5. **Reserve Seat Hold (FCFS):** Select an available class shift and click **Apply / Hold Seat** (`POST /classes/{classId}/holds`). A 10-minute (`HOLD_DURATION_SECONDS`) seat lock is created immediately.
6. **Pay Fee & Confirm Seat:** Click **Pay Admission Fee** (`POST /holds/{holdId}/confirm`) before the timer expires to lock the seat permanently and generate the admission receipt. Cancelling (`DELETE /holds/{holdId}`) frees the seat immediately for other applicants.

---

## Quick Start (Docker Compose)

Prerequisites: **Docker** and **Docker Compose** (no local .NET SDK, Node.js, or PostgreSQL installation is needed).

Start PostgreSQL, the .NET 8 backend (`http://localhost:8080`), and the React frontend (`http://localhost:3000`):

```bash
docker compose up --build
```

Run a second backend replica (`http://localhost:8081`) sharing the same PostgreSQL database:

```bash
docker compose --profile multi up --build
```

Stop containers while preserving database data in the named `pgdata` volume:

```bash
docker compose down
```

Stop containers and reset all database data:

```bash
docker compose down -v
```

### Environment Variables

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `DB_CONNECTION_STRING` | `backend` | `Host=db;Port=5432;Database=school_admission;Username=school_admin;Password=school_pass` | PostgreSQL connection string |
| `HOLD_DURATION_SECONDS` | `backend` | `600` | Seat hold window in seconds (default 10 minutes) |
| `SWEEP_INTERVAL_SECONDS` | `backend` | `3` | Background hold-expiry cleanup interval in seconds |
| `SINGLE_ADMISSION_PER_STUDENT` | `backend` | `true` | Enforce one active/confirmed seat per student globally |
| `ADMIN_PASSWORD` | `backend` | `""` | Optional environment override for admin login |
| `CORS_ALLOWED_ORIGINS` | `backend` | `*` | Allowed browser origins for CORS |
| `API_BASE_URL` | `frontend` | `http://localhost:8080` | Runtime backend API base URL injected by Nginx entrypoint |

---

## Running Automated Tests

### 1. Backend Integration & Concurrency Tests (56 Tests)
Covers 200-way parallel concurrency against 50 seats, 2-instance multi-process concurrency, idempotent payment confirmation, automatic expiry seat recovery, validation errors (4xx), routines, notifications, and admin workflows.

Via Docker Compose:
```bash
docker compose --profile test run --rm backend-tests
```

Locally (requires .NET 8 SDK and PostgreSQL running on port `5432`):
```bash
dotnet test backend/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
```

### 2. Frontend UI Tests (15 Tests)
Covers 17-digit BRN validation, live expiry countdown transitions without page reload, polling seat updates, single admission conflict blocking, admin login gate, mandatory profile gates, and Firebase post-login linking.

Via Docker Compose:
```bash
docker compose --profile test run --rm frontend-tests
```

Locally (requires Node.js 20+):
```bash
cd frontend && npm test -- --run
```

### 3. API Contract Smoke Script
With the stack running at `http://localhost:8080`:
```bash
./scripts/smoke-test.sh http://localhost:8080
```

---

## Core API Contract Reference

All endpoints accept and return JSON with UTC ISO-8601 timestamps ending in `Z`. Invalid inputs return structured 4xx responses (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `NOT_OWNER`, `INVALID_CREDENTIALS`), never 500.

| Method | Path | Header / Auth | Description |
|---|---|---|---|
| `POST` | `/classes` | None | Create a class shift (`{ "name": "...", "totalSeats": 120 }`) -> `201 Created` |
| `GET` | `/classes` | None | List all class shifts with live `heldSeats`, `confirmedSeats`, `availableSeats` |
| `GET` | `/classes/{classId}` | None | Get live seat counts for a single class shift |
| `POST` | `/classes/{classId}/holds` | `X-Student-Id` | Place a temporary seat hold -> `201 Created` or `409 Conflict` |
| `GET` | `/holds/{holdId}` | None | Get current hold status (`HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`) |
| `POST` | `/holds/{holdId}/confirm` | `X-Student-Id` | Confirm hold and settle fee (idempotent `200 OK`) |
| `DELETE` | `/holds/{holdId}` | `X-Student-Id` | Cancel hold and release seat (`204 No Content`) |
| `GET` | `/me/holds` | `X-Student-Id` | List all holds belonging to the student |
| `GET` / `PUT` | `/parent/profile` | `X-Student-Id` | Fetch or update the student & guardian admission dossier |
| `POST` | `/parent/documents` | `X-Student-Id` | Upload admission document metadata |
| `GET` | `/routines` | None | Fetch fixed shift hours and weekly schedules |
| `POST` | `/auth/admin/login` | None | Authenticate staff user and issue admin session token |
| `GET` | `/admin/dashboard` | Admin Token | Fetch admissions overview KPIs and class rosters |
| `GET` / `PUT` / `DELETE` | `/admin/applications*` | Admin Token | Filter, inspect, review, or delete applicant dossiers |
| `PUT` / `DELETE` | `/admin/classes/{classId}` | Admin Token | Update class configuration/fees or delete an unused class |

---

## Documentation

- Architecture diagrams, schema SQL, admission lifecycle state machine, concurrency sequence diagrams, and design decisions: [ASSUMPTIONS.md](./ASSUMPTIONS.md)
