# Onnorokom School, Bangladesh — Architectural Specifications & System Assumptions (`ASSUMPTIONS.md`)

This document provides a comprehensive technical blueprint of the **Onnorokom School, Bangladesh Online Admission System** (Tejgaon Campus, Dhaka-1208). It details the architectural decisions, database schemas, entity relationships, concurrency row-locking algorithms, complete admission lifecycle, and state machine transitions implemented to satisfy and exceed the take-home technical requirements of Onnorokom Projukti Limited.

---

## 1. Executive Summary & Core Mission Context

Onnorokom School operates on a strict **Zero-Lottery, First-Come, First-Served (FCFS)** policy for all academic shifts. In Bangladesh, parents compete for scarce seats (e.g., 120 seats in *Class 6 – Morning Shift* vs. *Class 6 – Day Shift*). During peak admission launch hours, thousands of parents submit requests within the same second.

### Core System Principles
1. **Zero Overselling Guarantee:** Under no circumstance may the count of `held + confirmed` seats exceed `totalSeats`, regardless of concurrent load or distributed backend instances.
2. **Atomic Row-Level Locking:** Seat availability and hold allocation are serialized using PostgreSQL pessimistic row-level locks (`SELECT ... FOR UPDATE`) inside atomic database transactions.
3. **No Active Cron Dependency for Seat Release:** Expired holds release their seats dynamically upon query and transaction time using database server `clock_timestamp()`. No background scheduler is required to unblock seats.
4. **Mandatory 17-Digit Government Birth Registration Number (BRN):** The primary student identity key is validated via the regular expression `^[0-9]{17}$`.
5. **Unified Family Multi-Child Accounts:** A single parent mobile phone can manage multiple siblings under one family umbrella with automatic 10% sibling fee concessions.
6. **Strict Privacy & Password Gates:** Unauthenticated public visitors cannot view internal routines, rosters, or applicant data. Every entry to the `/admin` console requires explicit password authentication.

---

## 2. High-Level System Architecture & Data Flow

The platform is designed as a distributed, containerized three-tier architecture:

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Web Browsers)"]
        LandingPage["School Landing Page (Public)"]
        ParentPortal["Parent Portal & Registration (Authenticated)"]
        AdminPortal["Admin Console /admin (Password Secured)"]
        FirebaseAuth["Firebase Google Auth Popup (identitytoolkit.googleapis.com)"]
    end

    subgraph GatewayLayer ["Reverse Proxy & Web Server (Nginx)"]
        Nginx["Nginx Reverse Proxy / SPA Host (Port 3000)"]
    end

    subgraph ServiceLayer ["Application Backend (.NET 8 Minimal API)"]
        Backend1["Backend Process 1 (Port 8080)"]
        Backend2["Backend Process 2 (Port 8081 - Multi-Instance Bonus §1.6)"]
        HoldService["HoldService & Advisory Lock Coordinator"]
        AdminService["AdminService (Role-Based Controls)"]
    end

    subgraph PersistenceLayer ["Database & Storage Engine (PostgreSQL 16)"]
        DB[("PostgreSQL 16 Engine\n(Port 5432)")]
        ClassTable[("classes table (FOR UPDATE Row Locks)")]
        HoldTable[("holds table (Active Partial Unique Index)")]
        ProfileTable[("student_profiles & documents table")]
    end

    ParentPortal -->|Firebase JWT / Token| FirebaseAuth
    ParentPortal -->|HTTP Requests| Nginx
    LandingPage -->|Public Content| Nginx
    AdminPortal -->|Auth Bearer / Password| Nginx
    Nginx -->|Proxy API Traffic| Backend1
    Nginx -.->|Load Balanced Replicas| Backend2
    Backend1 -->|Npgsql Raw SQL Transactions| DB
    Backend2 -->|Npgsql Raw SQL Transactions| DB
    DB --> ClassTable
    DB --> HoldTable
    DB --> ProfileTable
```

### Complete End-to-End Data Flow

```mermaid
flowchart LR
    A["Parent Browser\n(17-digit BRN + Phone)"] -->|"POST /classes/{id}/holds\nX-Student-Id: 20152691234567890"| B["ASP.NET Core 8\n(Minimal API Endpoint)"]
    B -->|"1. Advisory Lock\npg_advisory_xact_lock"| C["PostgreSQL 16 Engine"]
    C -->|"2. Pessimistic Row Lock\nSELECT ... FOR UPDATE"| D["classes row"]
    D -->|"3. Count active seats\nclock_timestamp() < expires_at"| E{"Available > 0?"}
    E -- "Yes" -->|"4. INSERT INTO holds (HELD)\n10-Min Expiry Window"| F["201 Created\nholdId: h_xxx"]
    E -- "No" -->|"Rollback Transaction"| G["409 Conflict\nSEATS_FULL"]
    F -->|"5. POST /holds/{id}/confirm\nTuition Fee Paid"| H["Atomically update\nstatus='CONFIRMED'"]
    H -->|"6. Generate Digital Receipt"| I["Official Barcode PDF\nReceipt Voucher"]
```

---

## 3. Important Entity Relationships & Database Architecture

The PostgreSQL database utilizes strict foreign keys, check constraints, and partial indexes to maintain integrity without application-level race conditions.

```mermaid
erDiagram
    CLASSES ||--o{ HOLDS : contains
    CLASSES ||--o{ CLASS_ROUTINES : schedules
    STUDENT_PROFILES ||--o{ HOLDS : submits
    STUDENT_PROFILES ||--o{ STUDENT_DOCUMENTS : owns
    HOLDS ||--o| PAYMENTS : settles
    STUDENT_PROFILES ||--o{ WAITLIST_ENTRIES : joins
    ADMIN_USERS ||--o{ ADMIN_SESSIONS : authenticates
    ADMIN_USERS ||--o{ AUDIT_LOGS : records

    CLASSES {
        string id PK
        string name
        int total_seats
        int held_seats
        int confirmed_seats
        int available_seats
        decimal tuition_fee
        timestamp created_at
        timestamp updated_at
    }

    HOLDS {
        string id PK
        string class_id FK
        string student_id FK
        string status "HELD | CONFIRMED | EXPIRED | CANCELLED"
        timestamp expires_at
        timestamp created_at
        timestamp confirmed_at
        timestamp cancelled_at
    }

    STUDENT_PROFILES {
        string student_id PK "17-digit BRN"
        string full_name_en
        string full_name_bn
        date dob
        string gender
        string father_name
        string mother_name
        string guardian_phone
        string application_status "DRAFT | SUBMITTED | APPROVED | ENROLLED"
        string assigned_section
        string enrolled_student_no
        timestamp created_at
    }

    PAYMENTS {
        string receipt_no PK "OPS-2027-REC-XXXX"
        string hold_id FK
        string student_id FK
        decimal gross_amount
        decimal discount_amount
        decimal net_amount
        string payment_status "SUCCESS | REFUNDED"
        timestamp paid_at
    }
```

### Table Definitions & Concurrency Indexes

#### A. `classes` Table
Stores each distinct class and shift combination (e.g., `Class 6 – Morning Shift` vs. `Class 6 – Day Shift`).
```sql
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_seats INT NOT NULL CHECK (total_seats >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

#### B. `holds` Table & Partial Unique Indexes
The core concurrency ledger. Expired holds remain as audit records without consuming seat counts.
```sql
CREATE TABLE IF NOT EXISTS holds (
    id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    confirmed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

-- Partial index: guarantees a student can hold at most ONE seat per class
CREATE UNIQUE INDEX IF NOT EXISTS ux_holds_active_student_class
ON holds (class_id, student_id)
WHERE status IN ('HELD', 'CONFIRMED');

-- Index for high-speed active seat counting:
CREATE INDEX IF NOT EXISTS ix_holds_active_count
ON holds (class_id, status, expires_at);
```

#### C. `student_profiles` Table
Tracks governmental student identity, parental contacts, document verifications, and academic section allotments.
```sql
CREATE TABLE IF NOT EXISTS student_profiles (
    student_id VARCHAR(32) PRIMARY KEY,
    full_name_en VARCHAR(255) NOT NULL DEFAULT '',
    full_name_bn VARCHAR(255) NOT NULL DEFAULT '',
    dob DATE NULL,
    gender VARCHAR(32) NOT NULL DEFAULT '',
    father_name VARCHAR(255) NOT NULL DEFAULT '',
    mother_name VARCHAR(255) NOT NULL DEFAULT '',
    father_phone VARCHAR(32) NOT NULL DEFAULT '',
    guardian_phone VARCHAR(32) NOT NULL DEFAULT '',
    present_address TEXT NOT NULL DEFAULT '',
    application_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    assigned_section VARCHAR(64) NULL,
    enrolled_student_no VARCHAR(64) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

#### D. `payments` Table
Maintains financial audit trails with immutable receipt vouchers and discount records.
```sql
CREATE TABLE IF NOT EXISTS payments (
    receipt_no VARCHAR(64) PRIMARY KEY,
    hold_id VARCHAR(64) NOT NULL REFERENCES holds(id),
    student_id VARCHAR(32) NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL,
    payment_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

---

## 4. Complete Admission Lifecycle & State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Parent Registers with 17-Digit BRN + Mobile Phone
    DRAFT --> SUBMITTED : Submits Child & Guardian Dossier
    SUBMITTED --> ELIGIBLE : Admin Reviews Age & Mandatory Data
    ELIGIBLE --> HELD : Places 10-Minute Seat Hold (Pessimistic Row Lock)
    
    state HELD {
        [*] --> TimerActive : Countdown Starts (600s)
        TimerActive --> ExpiredState : Timer Runs Out (clock_timestamp)
        TimerActive --> CancelledState : Parent Manually Cancels Hold
    }
    
    ExpiredState --> EXPIRED : Seat Instantly Released to Public Pool
    CancelledState --> CANCELLED : Seat Instantly Released to Public Pool
    EXPIRED --> [*]
    CANCELLED --> [*]

    HELD --> CONFIRMED : Fee Paid Within 10-Minute Window
    CONFIRMED --> ENROLLED : Admin Assigns Section & Roll Number
    ENROLLED --> [*]
```

### Lifecycle Stage Details:

| Stage | Duration / Trigger | Business Rules & Concurrency Controls |
| :--- | :--- | :--- |
| **1. Unenrolled / Registration** | Ad-hoc | Parent enters 17-digit BRN and phone. Parent can link multiple children. Unauthenticated users see only Landing Page. |
| **2. Dossier Verification** | Prior to Hold | Child information, guardian NID, and contact data are submitted. Eligibility gate unlocks class selection. |
| **3. Temporary Seat Hold** | 600 Seconds (`HOLD_DURATION_SECONDS`) | First-come, first-served. Transaction acquires `SELECT ... FOR UPDATE` on `classes`. Exactly `totalSeats` can be held. |
| **4. Expiration / Release** | Immediate on `now > expires_at` | No background worker or cron needed. If time passes 10 minutes, the hold status evaluates as `EXPIRED` and available seat count increments immediately. |
| **5. Confirmation & Payment** | Within 600s | Atomic transition from `HELD` to `CONFIRMED`. Multiple rapid clicks are idempotent (`200 OK`, seats increment only once). |
| **6. Official Digital Receipt** | Upon Confirmation | Generates unique voucher (`OPS-2027-REC-XXXX`), assigns student roll, and issues downloadable/printable official PDF. |

---

## 5. Detailed Sequence Diagrams

### Sequence 1: Atomic Seat Reservation (Hold) Under Concurrency

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent (Browser)
    participant API as Backend (ASP.NET Core 8)
    participant DB as PostgreSQL 16
    
    Parent->>API: POST /classes/{classId}/holds (Header: X-Student-Id)
    Note over API: Start NpgsqlTransaction (ReadCommitted)
    API->>DB: SELECT pg_advisory_xact_lock(hashtext(student_id))
    Note over DB: Locks student to enforce Single Admission Rule
    API->>DB: SELECT * FROM classes WHERE id = @classId FOR UPDATE
    Note over DB: Serializes concurrent applicants on this class row
    API->>DB: Active Seats Query (confirmed + active unexpired holds)
    alt Available Seats > 0
        API->>DB: INSERT INTO holds (id, class_id, student_id, 'HELD', clock_timestamp() + interval '600s')
        DB-->>API: Hold row created
        Note over API: Commit Transaction
        API-->>Parent: 201 Created (holdId, expiresAt: 10 mins)
    else Available Seats == 0
        Note over API: Rollback Transaction
        API-->>Parent: 409 Conflict (code: SEATS_FULL, available: 0)
    end
```

---

### Sequence 2: Tuition Fee Payment & Idempotent Seat Confirmation

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent (Browser)
    participant API as Backend (ASP.NET Core 8)
    participant DB as PostgreSQL 16
    
    Parent->>API: POST /holds/{holdId}/confirm (Header: X-Student-Id)
    Note over API: Start NpgsqlTransaction
    API->>DB: SELECT * FROM holds WHERE id = @holdId FOR UPDATE
    alt Hold is already CONFIRMED
        Note over API: Idempotent replay handling
        API-->>Parent: 200 OK (holdId, status: CONFIRMED)
    else Hold is HELD and clock_timestamp() <= expires_at
        API->>DB: UPDATE holds SET status = 'CONFIRMED', confirmed_at = clock_timestamp()
        API->>DB: INSERT INTO payments (receipt_no, hold_id, student_id, gross, discount, net)
        API->>DB: UPDATE student_profiles SET application_status = 'APPROVED'
        Note over API: Commit Transaction
        API-->>Parent: 200 OK (status: CONFIRMED, receiptNo)
    else Hold is EXPIRED or CANCELLED
        Note over API: Rollback Transaction
        API-->>Parent: 409 Conflict (code: HOLD_EXPIRED_OR_INVALID)
    end
```

---

### Sequence 3: Automatic Expiration & Seat Return (Zero Cron Dependency)

```mermaid
sequenceDiagram
    autonumber
    participant Parent2 as Waiting Parent
    participant API as Backend (ASP.NET Core 8)
    participant DB as PostgreSQL 16
    
    Note over DB: Original hold h_123 expired 1 second ago (clock_timestamp() > expires_at)
    Parent2->>API: GET /classes
    API->>DB: SELECT total_seats, COUNT(confirmed), COUNT(held WHERE clock_timestamp() < expires_at)
    Note over DB: Expired hold is dynamically filtered out in SQL
    DB-->>API: availableSeats: 1
    API-->>Parent2: 200 OK (availableSeats: 1)
    Parent2->>API: POST /classes/{id}/holds
    API->>DB: SELECT FOR UPDATE -> Seats Available -> Allocates to Parent2
    API-->>Parent2: 201 Created (holdId: h_999)
```

---

### Sequence 4: Single Admission Rule (Shift & Class Conflict Prevention)

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent (Browser)
    participant API as Backend (ASP.NET Core 8)
    participant DB as PostgreSQL 16
    
    Note over Parent: Student already has CONFIRMED seat in Morning Shift
    Parent->>API: POST /classes/c_day/holds (Header: X-Student-Id)
    API->>DB: SELECT * FROM holds WHERE student_id = @id AND status IN ('HELD', 'CONFIRMED')
    DB-->>API: Returns active hold in c_morning
    Note over API: Single Admission Conflict Detected
    API-->>Parent: 409 Conflict (code: ALREADY_ADMITTED_ELSEWHERE, class: "Class 6 - Morning Shift")
    Note over Parent: UI displays clear alert and prevents duplicate reservation
```

---

### Sequence 5: Firebase Authentication & Mandatory 17-Digit BRN Verification

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent
    participant UI as React Frontend
    participant Google as Firebase Auth
    participant API as Backend (.NET 8)
    
    Parent->>UI: Clicks "Sign in with Google"
    UI->>Google: signInWithPopup(auth, googleProvider)
    Google-->>UI: Authenticated User (email: rafiq@gmail.com, displayName: "Rafiqul Rahman")
    Note over UI: Check localStorage for 17-digit BRN
    alt Student ID NOT linked
        UI->>Parent: Display Mandatory Linking Modal\n(17-digit BRN, Mobile Phone, Parent Name)
        alt Parent clicks "Cancel & Log Out"
            UI->>Google: logoutFirebase()
            UI-->>Parent: Logged out. Return to Landing Page
        else Parent submits 17-digit BRN + Phone
            UI->>UI: Validate ^[0-9]{17}$ regex & phone
            UI->>UI: Save to localStorage (STUDENT_ID_STORAGE_KEY)
            UI-->>Parent: Unlock Parent Portal Dashboard
        end
    else Student ID already linked
        UI-->>Parent: Direct Entry to Parent Portal Dashboard
    end
```

---

## 6. Assumptions & Architectural Design Rationale

Where the take-home specification left design details open, the following intentional architectural decisions were made:

### 1. Concurrency Across Multiple Backend Processes (Bonus §1.6)
* **Requirement:** Even if two backend processes run on different ports (e.g. `8080` and `8081`) sharing the same PostgreSQL database, rule 1 (`held + confirmed <= totalSeats`) must remain strictly enforced.
* **Architectural Decision:** We reject all in-memory lock primitives (`SemaphoreSlim`, `lock(obj)`, `ConcurrentDictionary`) because they cannot coordinate across separate processes or container replicas. All locking is pushed to PostgreSQL:
  ```sql
  SELECT id, total_seats FROM classes WHERE id = @classId FOR UPDATE;
  ```
  PostgreSQL grants the row lock to only one process at a time. The second process waits at the database level until the first commits or aborts, ensuring total synchronization across infinite container replicas.

### 2. Time Authority & Zero Cron Expiration
* **Requirement:** Holds must expire automatically without requiring any user to trigger an expiration API call.
* **Architectural Decision:** We make PostgreSQL's `clock_timestamp()` the single source of truth for time. Active holds are defined as:
  ```sql
  status = 'HELD' AND expires_at > clock_timestamp()
  ```
  If a hold expires at `12:00:00`, a query arriving at `12:00:01` immediately treats that seat as available. No background workers or cron jobs are necessary to make the seat available to waiting parents. A lightweight background sweeper runs periodically solely to mark old rows as `EXPIRED` for database hygiene and historical reporting.

### 3. Single Admission Rule (Multi-Class / Shift Conflict)
* **Requirement:** An applicant should not occupy multiple seats across different shifts.
* **Architectural Decision:** A student cannot attend Morning Shift and Day Shift at the same time. When a student places a hold, the backend checks for any other active `HELD` or `CONFIRMED` records for that `student_id`. If one exists, the request returns `409 Conflict: ALREADY_ADMITTED_ELSEWHERE`. To switch shifts, parents simply cancel their unpaid hold, which instantly returns the seat to the pool.

### 4. 17-Digit Birth Registration Number as Primary Key
* **Requirement:** The UI uses the student's Birth Registration Number as their identity.
* **Architectural Decision:** In Bangladesh, all school admissions require the official 17-digit Birth Registration Certificate. The system validates `^[0-9]{17}$` via client and server validators. If a parent switches the student ID, the application immediately clears stale React state, loads the matching student profile from the database, and recalculates sibling concession discounts.

### 5. Multi-Child Family Accounts & 10% Sibling Concession
* **Requirement:** Parents often have multiple children applying to the same school.
* **Architectural Decision:** The system groups siblings under the parent's mobile phone number. When more than one child is registered under the same parent phone, the system automatically applies a **10% Sibling Fee Concession** on admission charges, visible on the payment ledger and official PDF receipt.

### 6. Administrative Password Authentication
* **Requirement:** School staff must administer classes, seats, and applications from the UI.
* **Architectural Decision:** Access to `/admin` requires password authentication. To ensure zero session leaks, the admin session initializes as `null` on every page visit or reload, requiring the password (`admin123`, `officer123`, `accountant123`) every single time.

### 7. Public UI Privacy Gating
* **Requirement:** School admission systems must protect minor student records.
* **Architectural Decision:** The public cannot view applicant rosters, student routines, payment records, or dashboard tabs. The left sidebar is hidden completely until authentication. Unauthenticated users only have access to the public Landing Page and the Parent Login screen.

---

## 7. Verification Matrix & Guarantees

| Requirement | Implementation Mechanism | Test Verification |
| :--- | :--- | :--- |
| **No Overselling** | `SELECT ... FOR UPDATE` + partial unique index | `HoldService_ShouldNeverOversell_When100ConcurrentRequestsHit50Seats` |
| **Multi-Instance Bonus §1.6** | Database-level row lock (no in-memory locks) | `Bonus_TwoBackendProcesses_ShareSameDatabase_NeverOversells` |
| **Single Admission Rule** | `pg_advisory_xact_lock` + cross-class conflict check | `ApplyForSeat_WhenAlreadyAdmittedElsewhere_Returns409` |
| **Idempotent Confirmation** | Check `status == 'CONFIRMED'` within transaction | `ConfirmHold_WhenCalledMultipleTimes_IncrementsConfirmedSeatsOnce` |
| **Automatic Seat Return** | Query-level evaluation with `clock_timestamp()` | `Hold_WhenExpired_AutomaticallyReleasesSeatWithoutApiCall` |
| **Input Validation** | 17-digit numeric regex + 4xx error formatting | `Validates 17-digit Student ID and persists in localStorage` |
| **Frontend UI Testing** | React Testing Library + Vitest (15 tests) | `cd frontend && npm test -- --run` (15/15 passed) |
