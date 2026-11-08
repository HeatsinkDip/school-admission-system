# School Admission System

Full-stack first-come, first-served online school admission system built with **ASP.NET Core 8**, **PostgreSQL 16**, **React 18 (Vite + TypeScript)**, and **Docker Compose**.

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

- **Frontend UI:** [http://localhost:3000](http://localhost:3000)
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

### Demo with a Short Hold Duration (e.g. 15 seconds)

```bash
HOLD_DURATION_SECONDS=15 docker compose up --build
```

---

## Running Automated Tests (Docker Only)

Both backend integration/concurrency tests (xUnit + `WebApplicationFactory` against real PostgreSQL) and frontend tests (Vitest + React Testing Library) run inside Docker via the `test` profile:

### 1. Backend Tests (including 200-applicant concurrency & 2-instance tests)

```bash
docker compose --profile test run --rm backend-tests
```

### 2. Frontend Tests

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

All concurrency guarantees (row-level `SELECT ... FOR UPDATE` on the class row, database clock comparisons via `clock_timestamp()`, and the partial unique index on active holds) live in PostgreSQL, so `heldSeats + confirmedSeats` never exceeds `totalSeats` even when requests hit both backend instances simultaneously.

---

## Architecture Overview

- **`backend/SchoolAdmission.Api`**:
  - Minimal API on .NET 8 + `NpgsqlDataSource`.
  - Versioned startup schema migration (`DbMigrator`) protected by `pg_advisory_lock` with automatic retry while PostgreSQL boots.
  - `HoldService` executes seat reservation in a single PostgreSQL transaction locking the target `classes` row (`FOR UPDATE`), expiring stale holds using the database clock (`clock_timestamp()`), verifying one active hold per student per class, checking `held + confirmed < total_seats`, and inserting the hold.
  - All read queries compute the **effective** status (`CASE WHEN status = 'HELD' AND expires_at <= now() THEN 'EXPIRED' ELSE status END`), so expired seats return immediately without waiting for the background sweeper (`HoldExpirySweeper`).
- **`frontend/`**:
  - React 18 + TypeScript single-page application served by Nginx in production.
  - `docker-entrypoint.sh` generates `/usr/share/nginx/html/config.js` (`window.__CONFIG__.API_BASE_URL`) at container startup so `API_BASE_URL` works at runtime without rebuilding the bundle.
  - All user-facing text is centralized in `src/strings.ts` for straightforward Bangla localization.

