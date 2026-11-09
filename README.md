# Onnorokom School, Bangladesh — Online Admission System

A resilient, high-concurrency First-Come, First-Served (FCFS) online school admission platform for **Onnorokom School, Bangladesh** (Tejgaon Campus, Dhaka-1208). Features a modern institutional **Landing Page**, an interactive **Parent Admission Portal** with **Firebase Google Authentication**, an integrated **Admissions AI/Rule Desk**, and a role-based, password-secured **Staff & Admin Console** (`/admin`).

Built with **ASP.NET Core 8 (.NET 8 Minimal APIs)**, **PostgreSQL 16**, **React 18 (Vite + TypeScript)**, **Docker Compose**, and deployed to **Firebase Hosting**.

---

## 🌐 Live Deployment & Access Points

| Service | Environment | Access URL | Credentials / Notes |
|---|---|---|---|
| **Live Production Web App** | Firebase Hosting | [https://onnorokom-school-admissions.web.app](https://onnorokom-school-admissions.web.app) | Public / Parent Login / Firebase Google Auth |
| **Local Frontend Portal** | Docker Compose | [http://localhost:3000](http://localhost:3000) | Full SPA (Landing, Parent Portal, Admin) |
| **Local Admin Console** | Docker Compose | [http://localhost:3000/admin](http://localhost:3000/admin) | Username: `admin` • Password: `admin123` |
| **Local Backend REST API** | Docker Compose | [http://localhost:8080](http://localhost:8080) | Swagger / OpenAPI at `/swagger` |
| **Local PostgreSQL Database** | Docker Compose | `localhost:5432` | User: `postgres` • Pass: `postgres` • DB: `school_admission` |

---

## 🏫 Key Features & System Principles

### 1. Zero Lottery • First-Come, First-Served (FCFS) Seat Allocation
- **10-Minute Atomic Hold Lock:** When a parent applies for an available class shift, the system issues an exclusive 10-minute hold (`201 Created`).
- **Mathematical Zero-Overselling Guarantee:** When 100+ parents compete for 50 remaining seats, PostgreSQL pessimistic row-level locking (`SELECT ... FOR UPDATE`) serializes reservation transactions. Exactly 50 requests succeed; subsequent requests immediately receive a structured `409 Conflict: SEATS_FULL` alert with zero database race conditions.
- **Dynamic Clock-Based Expiry:** Expired holds release their seats automatically upon query time using database server `clock_timestamp()`. No brittle background cron jobs or external polling schedulers required.

### 2. Mandatory 17-Digit Birth Registration Number & Single Admission Rule
- **Primary Identifier:** The government 17-digit Birth Registration Number (BRN) uniquely identifies every applicant child (`^[0-9]{17}$`).
- **Single Admission Per Student Rule:** Under school regulations, a student cannot hold seats or be admitted to Morning Shift and Day Shift at the same time, nor attend two different classes simultaneously. The backend enforces this atomically via per-student transaction advisory locks (`pg_advisory_xact_lock`), returning `409 Conflict: ALREADY_ADMITTED_ELSEWHERE`.
- **Shift Switching:** If a parent wishes to change shifts or classes, cancelling their active hold immediately releases the seat back to the school pool.

### 3. Parent Portal & Firebase Google Authentication
- **Dual Login Methods:** Parents can log in directly using their 17-digit Student BRN + Mobile Phone, or authenticate securely via **Firebase Google Sign-In**.
- **Mandatory Profile Linking Gate:** Upon Firebase Google sign-in, the system prompts the parent to link their child's 17-digit BRN and mobile phone before granting access to the parent dashboard.
- **Multi-Child Family Management & Sibling Concession:** Parents with multiple children can manage all siblings under one unified family account and receive an automatic **10% Sibling Fee Concession**.
- **Step-by-Step Admission Dossier:** Form guides parents through Student Dossier -> Document Verification -> Real-time Class & Shift Seat Hold -> Tuition Fee Payment -> Official Admission Receipt.

### 4. Talk to Admissions Desk (Interactive Counselor Bot)
- Interactive counselor modal accessible from the portal and landing page.
- Provides immediate answers regarding required documents, the 10-minute hold lock mechanism, sibling concessions, morning vs. day shift operating hours, and tuition fee schedules.

### 5. Role-Based Password-Secured Admin Console (`/admin`)
- Accessible only via explicit password authentication (hidden from public navigation for security).
- **Super Admin (Principal / IT):** Username `admin` / Password `admin123`
- **Admission Officer:** Username `officer` / Password `officer123`
- **Accountant (Finance):** Username `accountant` / Password `accountant123`
- **Class Rosters & Student Inspections:** Dedicated "View Students" button on every class shift to view enrolled students, verify application dossiers, inspect uploaded certificates, grant concessions, or delete invalid applications.

---

## 🏗️ Tech Stack

- **Backend:** C# (.NET 8 Minimal APIs), Npgsql Raw SQL, ASP.NET Core Dependency Injection, Health Checks, Swagger/OpenAPI.
- **Frontend:** React 18, Vite, TypeScript, Lucide Icons, plain responsive institutional CSS design system.
- **Authentication:** Firebase Auth (Google Sign-In) + Custom Admin Password Token Authentication.
- **Database:** PostgreSQL 16 (Pessimistic row-locking, partial unique indexes, check constraints, transaction advisory locks).
- **Deployment:** Docker & Docker Compose (local multi-container setup) and Firebase Hosting (live production CDN).

---

## 🚀 Quick Start (Docker Compose)

Clone the repository and run the entire stack with a single command:

```bash
docker compose up --build
```

Wait until all services report healthy:
- Open **[http://localhost:3000](http://localhost:3000)** in your browser for the **School Landing Page & Parent Portal**.
- Open **[http://localhost:3000/admin](http://localhost:3000/admin)** for the **Admin Console**.
- Open **[http://localhost:8080/swagger](http://localhost:8080/swagger)** for the **Backend API Swagger Documentation**.

### Demo Credentials for Quick Testing
- **Student BRN:** `20152691234567890` (or click *"⚡ Quick Fill Demo Credentials"* in the portal)
- **Parent Mobile Phone:** `01712345678`
- **Parent Name:** `Mr. Rafiqul Rahman`
- **Admin Login:** Username `admin` / Password `admin123`

To stop the containers:
```bash
docker compose down
```

To stop containers and wipe the database volume:
```bash
docker compose down -v
```

---

## 🧪 Automated Test Suites

All tests are self-contained and run both inside Docker and natively via standard CLI tools:

### 1. Backend Automated Tests (56 Tests)
Validates concurrency, 2-instance distributed scaling, row-locking serialization, hold expiration, single admission rule, shift routines, payment idempotency, and admin CRUD workflows.

```bash
# Inside Docker Compose:
docker compose --profile test run --rm backend-tests

# Or locally with .NET 8 SDK:
dotnet test backend/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
```

### 2. Frontend Automated Tests (15 Tests)
Validates 17-digit BRN validation, single admission rule UI enforcement, mandatory profile field gates, shift routines, countdown timers, API error mapping, Firebase linking, and admin authentication.

```bash
# Inside Docker Compose:
docker compose --profile test run --rm frontend-tests

# Or locally with Node.js:
cd frontend && npm test -- --run
```

### 3. End-to-End API Smoke Test
```bash
./scripts/smoke-test.sh http://localhost:8080
```

---

## 📡 Core API Contract Summary

All requests accept and return JSON. Timestamps follow ISO-8601 UTC format with trailing `Z`.

| Endpoint | Method | Header | Description |
|---|---|---|---|
| `/classes` | GET | None | List classes with seat counts (`totalSeats`, `heldSeats`, `confirmedSeats`, `availableSeats`) |
| `/classes` | POST | Admin Auth | Create new class shift (`name`, `totalSeats`, `ageRange`, `tuitionFee`) |
| `/classes/{classId}` | GET | None | Get specific class seat availability |
| `/classes/{classId}/holds` | POST | `X-Student-Id` | Reserve temporary 10-minute hold (`201 Created` or `409 Conflict`) |
| `/holds/{holdId}` | GET | None | Check hold status (`HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`) |
| `/holds/{holdId}/confirm` | POST | `X-Student-Id` | Confirm admission & process payment (idempotent `200 OK`) |
| `/holds/{holdId}` | DELETE | `X-Student-Id` | Cancel hold and immediately release seat (`204 No Content`) |
| `/me/holds` | GET | `X-Student-Id` | Retrieve current student's holds with class and shift details |
| `/me/profile` | GET / PUT | `X-Student-Id` | Get or update student dossier details and document verification state |
| `/admin/classes/{classId}` | DELETE | Admin Auth | Delete empty class shift (safely blocked if confirmed seats exist) |
| `/admin/applications` | GET | Admin Auth | Search, filter, and inspect applicant dossiers with pagination |
| `/admin/applications/{studentId}` | PUT / DELETE | Admin Auth | Update dossier status (`ELIGIBLE`, `APPROVED`, `REJECTED`) or delete record |
| `/auth/admin/login` | POST | None | Authenticate admin username/password session |

---

## 🔒 Security & Privacy Guarantees

- **No Public Leak of Applicant Data:** Unauthenticated public visitors on the landing page cannot see internal class routines, student rosters, or payment records.
- **Hidden & Password-Gated Admin Access:** Admin portal links are intentionally hidden from public view and strictly require authentication with bcrypt-verified passwords.
- **Parameterized SQL:** All database queries utilize parameterized SQL via Npgsql to eliminate SQL injection vulnerabilities.
- **Environment Isolation:** Sensitive credentials and Firebase configuration keys are isolated via environment variables and excluded from version control.

---

## 📖 Deep Architecture & Design Decisions

For an exhaustive technical breakdown of:
- High-level architecture diagrams and data flow maps
- Entity Relationship (ER) diagrams & database schema definitions
- Complete admission lifecycle & state machine transitions
- 5 comprehensive concurrency sequence diagrams (`FOR UPDATE` locking, expiry race conditions, single-admission rules)
- Rationale behind PostgreSQL raw SQL vs. ORM selection

Please consult the companion specification document: **[`ASSUMPTIONS.md`](file:///Users/dipayon/IUB%20Official/Projects/school%20admission%20system/ASSUMPTIONS.md)**.
