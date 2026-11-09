# Onnorokom Projukti School — Online Admission System

A resilient, high-concurrency first-come, first-served online school admission platform for **Onnorokom Projukti School**. Features a **School Landing Page**, an interactive **Parent Portal**, and a role-based, password-secured **Admin Console** (`/admin`), built with **ASP.NET Core 8**, **PostgreSQL 16**, **React 18 (Vite + TypeScript)**, **Docker Compose**, and production-grade **Kubernetes (K8s)** manifests.

---

## 1. System Overview & Key Features

### A. School Branding & Modern Landing Page
- Official School Name: **Onnorokom Projukti School**.
- Dedicated, modern **Landing Page** featuring school mission, academic session timeline, STEM curriculum highlights, live seat availability preview, and clear navigation buttons (**"Apply for Admission"** and **"Staff / Admin Login"**).
- Accessible from `/` and switchable at any time from the Parent Portal sidebar (**"School Home (Overview)"**).

### B. Parent Workflow & Eligibility Gate
1. **Parent Registration & 17-digit Birth Registration Number (`X-Student-Id`):**
   - The primary identifier for each student is their mandatory 17-digit government Birth Registration Number.
2. **Student & Guardian Profile Submission:**
   - Parents fill out complete child details (English & Bengali name, DOB, blood group, previous school), guardian details (Father & Mother NID, phone, occupation), and financial information.
3. **Admission Office Eligibility Verification Gate:**
   - After profile submission, the Admission Office inspects the dossier in the Admin Console and marks the student **ELIGIBLE / APPROVED**.
   - Available classes and seat holds are **unlocked only after the student is verified eligible**, ensuring admission criteria and age standards are met prior to seat reservation.

### C. Concurrency Guarantee: 100+ Users Competing for 50 Seats
- Admission is strictly first-come, first-served (no lottery).
- When 100+ parents click to reserve seats in a 50-seat class simultaneously:
  - Database-level pessimistic locking (`SELECT ... FOR UPDATE` via Npgsql) serializes transactions deterministically.
  - Exactly the first 50 transactions secure seats and receive a 10-minute hold (`201 Created`).
  - Subsequent requests receive `409 Conflict: NO_SEATS_AVAILABLE` with an instant human-readable modal alert explaining that all seats have been reserved, offering immediate waitlist placement.
  - **Zero overselling, mathematically guaranteed.**

### D. Guaranteed Seat Confirmation & Official PDF Receipt
- Paying the admission fee within the hold window confirms the seat permanently.
- The system generates an official **Downloadable / Printable Admission PDF Receipt** with "Onnorokom Projukti School" header, unique voucher number (`RCP-2027-XXXX`), fee breakdown (gross total, sibling concession discount, net paid), student registration number, registrar seal, and official admission guarantee.

### E. User Action Alert Modals & Real-Time Notification System
- Dynamic modal dialog (`ActionAlertModal`) presents action feedback with distinct status colors, icons, countdown clocks, and contextual recovery actions.
- In-app notification center notifies users in real time of hold confirmations, countdown alerts, waitlist movements, and administrative notices.

### F. Admin Console with Full CRUD Operations
- Accessible at `/admin` with role-based password authentication:
  - **Super Admin (Principal / IT):** Username `admin` / Password `admin123`
  - **Admission Officer:** Username `officer` / Password `officer123`
  - **Accountant (Finance):** Username `accountant` / Password `accountant123`
- Full **Create, Read, Update, Delete (CRUD)** capabilities from the UI:
  - **Classes:** Create new class-shifts, edit seat capacity & age limits, delete empty/cancelled classes (with foreign-key safety protecting confirmed enrollments).
  - **Applications:** Search and filter dossiers, update student details, verify documents, grant tuition concessions, enroll sections, or delete rejected/abandoned applications.
  - **Live Alerts & Feed:** Delete notices and manage broadcast announcements.

---

## 2. Tech Stack & Architecture

- **Backend:** C# on .NET 8, ASP.NET Core Minimal APIs, PostgreSQL 16 with Npgsql.
- **Frontend:** React 18, Vite, TypeScript, Lucide Icons, plain responsive CSS design system.
- **Runtime Configuration:** Backend URL injected into `/config.js` (`window.__CONFIG__.API_BASE_URL`) at container startup.
- **Containerization & Orchestration:** Docker, Docker Compose, and Kubernetes (with HorizontalPodAutoscaler).

---

## 3. Quick Start (Docker Compose)

From the repository root:

```bash
docker compose up --build
```

Access points:
- **School Landing Page & Parent Portal:** [http://localhost:3000/](http://localhost:3000/)
- **Admin Console (Password-Secured):** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **PostgreSQL Database:** `localhost:5432`

To stop the containers:
```bash
docker compose down
```

To stop and wipe database data:
```bash
docker compose down -v
```

---

## 4. Kubernetes (K8s) Production Deployment

Kubernetes manifests are located in `k8s/`:

```bash
# Deploy entire cluster with Horizontal Pod Autoscaler (HPA):
kubectl apply -k k8s/

# Monitor HPA autoscaling during admission burst traffic:
kubectl get hpa backend-hpa -n school-admission --watch
```
See [`k8s/README.md`](file:///Users/dipayon/IUB%20Official/Projects/school%20admission%20system/k8s/README.md) for full architecture details and cloud deployment instructions.

---

## 5. Automated Test Suites

All tests run inside Docker without requiring local SDK installations:

### 1. Backend Tests (51 tests: concurrency, 2-instance scaling, hold expiry, API contract, CRUD & admin workflows)
```bash
docker compose --profile test run --rm backend-tests
```

### 2. Frontend Tests (8 tests: student ID validation, countdown expiry, API error mapping, polling, admin authentication, child dossier, notifications, landing page)
```bash
docker compose --profile test run --rm frontend-tests
```

### 3. End-to-End API Contract Smoke Test
```bash
./scripts/smoke-test.sh http://localhost:8080
```

---

## 6. API Contract Summary (Exact Specification)

Base URL: `http://localhost:8080` (all requests/responses JSON, ISO-8601 UTC timestamps with trailing `Z`).

| Endpoint | Method | Header | Description |
|---|---|---|---|
| `/classes` | POST | None | Create class-shift `{ "name": "...", "totalSeats": 120 }` |
| `/classes` | GET | None | List classes with seats (`totalSeats`, `heldSeats`, `confirmedSeats`, `availableSeats`) |
| `/classes/{classId}` | GET | None | Get specific class seat availability |
| `/classes/{classId}/holds` | POST | `X-Student-Id` | Place temporary hold (returns `201` on success, `409` if full) |
| `/holds/{holdId}` | GET | None | Get hold status (`HELD`, `CONFIRMED`, `EXPIRED`, `CANCELLED`) |
| `/holds/{holdId}/confirm` | POST | `X-Student-Id` | Confirm admission & simulate payment (idempotent `200`) |
| `/holds/{holdId}` | DELETE | `X-Student-Id` | Cancel hold and free seat (`204 No Content`) |
| `/me/holds` | GET | `X-Student-Id` | List student's holds with class details |

### Extended Management Endpoints
- `DELETE /admin/classes/{classId}` — Delete class (blocked if confirmed seats exist)
- `PUT /admin/applications/{studentId}` — Update student application dossier
- `DELETE /admin/applications/{studentId}` — Delete application records
- `DELETE /admin/notifications/{id}` — Delete live alert notice
- `POST /auth/admin/login` & `/logout` — Admin session authentication
