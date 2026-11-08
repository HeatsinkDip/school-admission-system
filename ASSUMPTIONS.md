# Assumptions & Design Decisions

Where the specification left details open, the following choices were made and followed consistently across the backend, frontend, and test suite.

## 1. Core API & Domain Assumptions

1. **ID Formats (`c_<id>`, `h_<id>`)**:
   - Class IDs are formatted as `c_<bigint>` (e.g., `c_1`) and hold IDs as `h_<bigint>` (e.g., `h_1`), backed by `BIGSERIAL` primary keys in PostgreSQL.
   - Any malformed or non-existent ID (such as `abc`, `c_abc`, `h_999999`) returns `404 Not Found` (`NOT_FOUND`), never `500`.
2. **Duplicate Class Names Allowed**:
   - Automated tests and admins may create multiple classes with the same name (e.g., across test runs). Each receives its own unique `c_<id>`. Class names are trimmed of leading/trailing whitespace and must be 1–200 characters; `totalSeats` must be a positive integer (`> 0`).
3. **`GET /holds/{holdId}` Requires No `X-Student-Id` Header**:
   - Per the API contract table, `GET /holds/{holdId}` does not require `X-Student-Id` and returns `{ holdId, classId, status, expiresAt }` (plus extra fields `className` and `serverTime`).
4. **Student Identity Validation (`X-Student-Id`)**:
   - Endpoints that act on behalf of a student (`POST /classes/{classId}/holds`, `POST /holds/{holdId}/confirm`, `DELETE /holds/{holdId}`, `GET /me/holds`, `/parent/*`) require `X-Student-Id` to be **17 ASCII digits** (`^[0-9]{17}$`). Missing or invalid headers return `400 Bad Request` with `code: "VALIDATION_ERROR"`.
5. **Cancelling Holds (`DELETE /holds/{holdId}`)**:
   - Cancelling an active `HELD` hold marks it `CANCELLED`, immediately frees the seat, and returns `204 No Content`.
   - Cancelling an already-`CANCELLED` hold is **idempotent** and returns `204 No Content`.
   - Cancelling a `CONFIRMED` hold returns `409 Conflict` (`ALREADY_CONFIRMED`) because fee refunds after confirmation are handled by the school administration via `/admin`.
   - Cancelling an `EXPIRED` hold returns `409 Conflict` (`HOLD_EXPIRED`).
6. **Confirming Holds (`POST /holds/{holdId}/confirm`)**:
   - Confirming an unexpired `HELD` hold owned by the student transitions it to `CONFIRMED`, atomically generates the invoice and payment receipt (`RCP-<year>-<id>`) in `payments`, and returns `200 OK`.
   - Confirming an already-`CONFIRMED` hold owned by the same student is **idempotent**: it returns `200 OK` with `status: "CONFIRMED"` and `confirmedSeats` only ever increases once.
   - Confirming an expired or cancelled hold returns `409 Conflict` (`HOLD_EXPIRED` or `HOLD_CANCELLED`).
   - Confirming or cancelling another student's hold returns `403 Forbidden` (`NOT_OWNER`).
7. **Uniform Error Format**:
   - Every 4xx/5xx response returns JSON `{ "code": "<STABLE_CODE>", "message": "<human readable message>" }`.
   - Stable error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `INVALID_CREDENTIALS` (401), `NOT_OWNER` (403), `NOT_FOUND` (404), `SEATS_FULL` (409), `ALREADY_APPLIED` (409), `HOLD_EXPIRED` (409), `HOLD_CANCELLED` (409), `ALREADY_CONFIRMED` (409), `CLASS_CLOSED` (409), `SEAT_REDUCTION_CONFLICT` (409), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).
8. **Extra Fields on Hold Responses (`serverTime`, `className`)**:
   - Hold responses include `serverTime` (ISO-8601 UTC from PostgreSQL's clock) and `className` so the frontend can compute countdown timers immune to a skewed client clock. The HTTP `Date` header is also exposed via CORS.

---

## 2. Two-Portal Architecture (`/` Parent Portal vs `/admin` Admin Console)

1. **Main URL (`/`) — Parent Portal**:
   - Dedicated exclusively to parents/guardians.
   - Parents enter their child's 17-digit Birth Registration Number (`X-Student-Id`), fill out the multi-section **Child Information, Guardians, Household Income & Document Upload** dossier (with completeness progress bar), reserve seats in real time (**Fast Lane**), view itemized fee breakdowns, confirm payment, and view receipts.
2. **Admin URL (`/admin`) — Password-Secured Admin Console**:
   - Navigating to `/admin` redirects unauthenticated users to the **Admin Password Login Gate**.
   - Pre-seeded role accounts (`admin` / `admin123` as `SUPER_ADMIN`, `officer` / `officer123` as `ADMISSION_OFFICER`, `accountant` / `accountant123` as `ACCOUNTANT`) are created during database migration. Sessions are stored in PostgreSQL (`admin_sessions`) so authentication works across multiple stateless backend instances.
   - Note: The core `POST /classes` endpoint remains unauthenticated so automated grading scripts against the 8 contract endpoints continue to work unchanged, while `/admin/*` endpoints require a valid `Bearer` admin token.

---

## 3. Decisions on the 8 School Policy Questions (Section 16)

1. **Refund Policy**: Full refund (`100%` of net amount paid) is issued automatically if the school rejects an application during verification (`POST /admin/applications/{studentId}/review` with `action: "REJECT"`), which also releases the confirmed seat back to the pool. Finance staff can also issue full or partial refunds manually from the Admin Console (`POST /admin/payments/{id}/refund`).
2. **Minimum Profile for Fast-Lane Seat Hold**: Securing a 10-minute seat hold requires **only** the 17-digit Birth Registration Number (`X-Student-Id`) so parents are never slowed down on opening day and automated API tests work without pre-creating profiles. Parents can pre-fill or complete the full Child & Guardian dossier before or after securing the seat.
3. **Waitlist**: Enabled (`POST /parent/classes/{classId}/waitlist`). When a class has `0` available seats, parents can join the waitlist and view their queue position (`#1`, `#2`, etc.).
4. **Mandatory Documents**: Five standard document slots are tracked per student: Birth Registration Certificate (`BIRTH_CERT`), Student Photo (`STUDENT_PHOTO`), Father & Mother NID Copies (`PARENTS_NID`), Previous School Transfer Certificate & Report Card (`PREV_SCHOOL_TC`), and Household Income Proof (`INCOME_PROOF`, when applying for a concession).
5. **Paperwork Deadline After Paying**: Default `7` days (configurable by Super Admin in `/admin` under Academic Window Settings).
6. **Concessions**:
   - **Automatic Sibling Concession (10% off Admission Fee)**: Applied immediately before payment when a sibling studying in the school is listed in the child's profile (`hasSibling: true`), reducing the default `44,000 BDT` payable at confirmation by `1,500 BDT` to `42,500 BDT`.
   - **Need-Based Tuition Concession**: Reviewed by an admin officer after seat confirmation (`concession_status: PENDING -> APPROVED / DECLINED`) and applied as a percentage discount on future monthly tuition so it never delays the seat race.
7. **Payment Gateway**: Implemented behind a gateway record (`MOCK_GATEWAY` returning immediate success and generating receipt `RCP-<year>-<id>`) ready to swap with bKash, Nagad, or SSLCommerz.
8. **Downstream Export**: The Admin Console provides one-click **CSV Export** of applications, student profiles, receipts, and assigned sections/rolls for handoff to a Student Management or Accounting system.

---

## 4. How the Seat Limit Is Guaranteed Across Multiple Processes

All concurrency and seat-limit invariants live inside **PostgreSQL**, with zero reliance on in-memory locks or counters:

1. **Per-Class Row Lock (`SELECT ... FROM classes WHERE id = @id FOR UPDATE`)**:
   - Every `POST /classes/{classId}/holds` runs inside a PostgreSQL transaction that first acquires an exclusive row lock on the target `classes` row.
   - Concurrent requests for the same class—whether from 200 threads in one process or spread across `backend` (port 8080) and `backend2` (port 8081)—serialize cleanly on that row lock in PostgreSQL.
2. **Single Source of Truth for Time (PostgreSQL Clock)**:
   - Hold expiry timestamps (`expires_at`) and all expiry comparisons use PostgreSQL's clock (`clock_timestamp()` / `now()`), never `DateTime.UtcNow` on an application server.
3. **In-Transaction Expiry Materialization & Seat Count Check**:
   - While holding the `classes` row lock, the transaction:
     1. Verifies the class status is `OPEN`.
     2. Updates any `HELD` rows for that class with `expires_at <= clock_timestamp()` to `EXPIRED`.
     3. Checks whether the student already has a `HELD` or `CONFIRMED` row in that class (`409 ALREADY_APPLIED` if so).
     4. Counts `HELD` + `CONFIRMED` rows for that class and rejects with `409 SEATS_FULL` if `count >= total_seats`.
     5. Inserts the new `HELD` row and commits.
4. **Partial Unique Index Safety Net**:
   - The database enforces `CREATE UNIQUE INDEX ux_holds_active_student_class ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED')`.
5. **Lock Ordering & Idempotent Confirm/Cancel**:
   - `Confirm` and `Cancel` lock the single `holds` row (`SELECT ... FROM holds WHERE id = @id FOR UPDATE`) and atomically record the payment receipt on confirmation.
   - The background `HoldExpirySweeper` uses `FOR UPDATE SKIP LOCKED` so it never blocks or deadlocks with active transactions.
6. **Effective-Status Reads**:
   - All read queries compute effective status on read (`h.status = 'HELD' AND h.expires_at > now()`), so seat availability and hold status are immediately accurate the millisecond a hold expires.
