# School Admission System

Full-stack first-come, first-served online school admission platform with two separate interfaces (**Parent Portal** at `/` and password-secured **Admin Console** at `/admin`), built with **ASP.NET Core 8**, **PostgreSQL 16**, **React 18 (Vite + TypeScript)**, and **Docker Compose**.

## Prerequisites

- **Docker** (with `docker compose`) is the **only** prerequisite required to build, run, and test the entire stack.
- For local non-Docker development (optional): .NET 8 SDK and Node.js 20+.

---

## Quick Start

From the repository root:

```bash
docker compose up --build
```

Once the containers are healthy:

- **Parent Portal (Main URL):** [http://localhost:3000/](http://localhost:3000/)
  - Parents enter their child's **17-digit Birth Registration Number (`X-Student-Id`)**, fill out the **Child Information, Guardians, Household Income & Document Upload** dossier (Slow Lane / Pre-fill Drafts), reserve a seat in real time (**Fast Lane**), view the itemized **Fee Breakdown & Automatic Sibling Concession**, pay the admission fee within the live countdown window, and view **Official Payment Receipts & Enrollment Status**.
- **Admin Console (`/admin` — Password Secured):** [http://localhost:3000/admin](http://localhost:3000/admin)
  - Navigating to `/admin` opens the **Admin Password Login Gate** before granting access to the Admin Console.
  - **Pre-seeded Staff Credentials:**
    - **Super Admin (Principal / IT):** Username `admin` / Password `admin123`
    - **Admission Officer:** Username `officer` / Password `officer123`
    - **Accountant (Finance):** Username `accountant` / Password `accountant123`
  - **Admin Capabilities:** Live Seat Utilization Dashboard, Class-Shift & Fee Structure Builder, Application & Document Verification Queue, Need-Based Concession Review, Student Section Enrollment, Payment & Refund Management, CSV Report Export, Academic Window Settings, and Immutable Audit Log.
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **PostgreSQL:** `localhost:5432` (persisted in the named Docker volume `pgdata`)

To stop the stack without losing data:

```bash
docker compose down
```

To reset all database data as well:

```bash
docker compose down -v
```

---

## Configuration (Environment Variables)

All settings have sensible defaults in `docker-compose.yml` and can be overridden on the command line:

| Variable | Default | Description |
| --- | --- | --- |
| `HOLD_DURATION_SECONDS` | `600` (10 min) | How long a temporary seat hold stays active before expiring automatically. |
| `DB_CONNECTION_STRING` | `Host=db;Port=5432;Database=school_admission;Username=school_admin;Password=school_pass` | PostgreSQL connection string for the backend. |
| `API_BASE_URL` | `http://localhost:8080` | Backend base URL written at container startup into `/config.js` (`window.__CONFIG__.API_BASE_URL`). In local Vite dev, `VITE_API_URL` is also supported. |
| `SWEEP_INTERVAL_SECONDS` | `3` | Interval at which the background sweeper marks expired `HELD` rows as `EXPIRED`. |
| `ADMIN_PASSWORD` | `admin123` | Optional override password for the `admin` account on `/admin`. |

### Demo with a Short Hold Duration (e.g. 15 seconds)

```bash
HOLD_DURATION_SECONDS=15 docker compose up --build
```

---

## Running Automated Tests (Docker Only)

Both backend integration/concurrency tests (xUnit + `WebApplicationFactory` against real PostgreSQL) and frontend tests (Vitest + React Testing Library) run inside Docker via the `test` profile:

### 1. Backend Tests (50 tests: concurrency, 2-instance, expiry, contract & portal/admin workflows)

```bash
docker compose --profile test run --rm backend-tests
```

### 2. Frontend Tests (6 tests: Student ID, countdown expiry, error mapping, polling, `/admin` password login & Child Profile form)

```bash
docker compose --profile test run --rm frontend-tests
```

### 3. End-to-End API Contract Smoke Test

With the stack running (`docker compose up -d`), run:

```bash
./scripts/smoke-test.sh http://localhost:8080
```

---

## Bonus: Multi-Process Backend Mode (`multi` profile)

To run **two independent backend processes** (`backend` on `http://localhost:8080` and `backend2` on `http://localhost:8081`) sharing the same PostgreSQL database:

```bash
docker compose --profile multi up --build
```

All concurrency guarantees (row-level `SELECT ... FOR UPDATE` on the class row, database clock comparisons via `clock_timestamp()`, partial unique index on active holds, and PostgreSQL-backed admin sessions) live in PostgreSQL, so `heldSeats + confirmedSeats` never exceeds `totalSeats` even when requests hit both backend instances simultaneously.

---

## API Overview

### 1. Core Seat Engine (Exact Assignment Contract)
- `POST /classes` — Create class-shift
- `GET /classes` — List classes with `totalSeats`, `heldSeats`, `confirmedSeats`, `availableSeats`
- `GET /classes/{classId}` — Single class-shift
- `POST /classes/{classId}/holds` — Apply for seat hold (`X-Student-Id` header)
- `GET /holds/{holdId}` — Hold status (`HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`)
- `POST /holds/{holdId}/confirm` — Pay admission fee & confirm hold (`X-Student-Id` header; also generates invoice & payment receipt atomically)
- `DELETE /holds/{holdId}` — Cancel hold (`X-Student-Id` header)
- `GET /me/holds` — List all holds for `X-Student-Id`

### 2. Extended Parent Portal & Admin Console Endpoints
- **Admin Auth (`/auth/admin/*`):** `POST /auth/admin/login`, `GET /auth/admin/me`, `POST /auth/admin/logout`
- **Parent Portal (`/parent/*`):** `GET /parent/profile`, `PUT /parent/profile`, `POST /parent/documents`, `GET /parent/classes/{classId}/fees`, `GET /parent/payments`, `POST /parent/classes/{classId}/waitlist`, `GET /parent/waitlist`
- **Admin Console (`/admin/*`):** `GET /admin/dashboard`, `PUT /admin/settings`, `POST /admin/classes`, `PUT /admin/classes/{classId}`, `GET /admin/applications`, `GET /admin/applications/{studentId}`, `POST /admin/applications/{studentId}/review`, `POST /admin/applications/{studentId}/documents/verify`, `POST /admin/applications/{studentId}/concession`, `GET /admin/payments`, `POST /admin/payments/{paymentId}/refund`, `GET /admin/waitlist`, `GET /admin/audit-logs`
