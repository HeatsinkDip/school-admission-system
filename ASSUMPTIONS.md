# Assumptions & Design Decisions

Where the specification left details open, the following choices were made and followed consistently across the backend, frontend, and test suite.

## 1. API & Domain Assumptions

1. **ID Formats (`c_<id>`, `h_<id>`)**:
   - Class IDs are formatted as `c_<bigint>` (e.g., `c_1`) and hold IDs as `h_<bigint>` (e.g., `h_1`), backed by `BIGSERIAL` primary keys in PostgreSQL.
   - Any malformed or non-existent ID (such as `abc`, `c_abc`, `h_999999`) returns `404 Not Found` (`NOT_FOUND`), never `500`.
2. **Duplicate Class Names Allowed**:
   - Automated tests and admins may create multiple classes with the same name (e.g., across test runs). Each receives its own unique `c_<id>`. Class names are trimmed of leading/trailing whitespace and must be 1–200 characters; `totalSeats` must be a positive integer (`> 0`).
3. **`GET /holds/{holdId}` Requires No `X-Student-Id` Header**:
   - Per the API contract table, `GET /holds/{holdId}` does not require `X-Student-Id` and returns `{ holdId, classId, status, expiresAt }` (plus extra fields `className` and `serverTime`).
4. **Student Identity Validation (`X-Student-Id`)**:
   - Endpoints that act on behalf of a student (`POST /classes/{classId}/holds`, `POST /holds/{holdId}/confirm`, `DELETE /holds/{holdId}`, `GET /me/holds`) require `X-Student-Id` to be **17 ASCII digits** (`^[0-9]{17}$`). Missing or invalid headers return `400 Bad Request` with `code: "VALIDATION_ERROR"`.
5. **Cancelling Holds (`DELETE /holds/{holdId}`)**:
   - Cancelling an active `HELD` hold marks it `CANCELLED`, immediately frees the seat, and returns `204 No Content`.
   - Cancelling an already-`CANCELLED` hold is **idempotent** and returns `204 No Content`.
   - Cancelling a `CONFIRMED` hold returns `409 Conflict` (`ALREADY_CONFIRMED`) because fee refunds after confirmation are out of scope for the online self-service flow.
   - Cancelling an `EXPIRED` hold returns `409 Conflict` (`HOLD_EXPIRED`).
6. **Confirming Holds (`POST /holds/{holdId}/confirm`)**:
   - Confirming an unexpired `HELD` hold owned by the student transitions it to `CONFIRMED` and returns `200 OK`.
   - Confirming an already-`CONFIRMED` hold owned by the same student is **idempotent**: it returns `200 OK` with `status: "CONFIRMED"` and `confirmedSeats` only ever increases once.
   - Confirming an expired or cancelled hold returns `409 Conflict` (`HOLD_EXPIRED` or `HOLD_CANCELLED`).
   - Confirming or cancelling another student's hold returns `403 Forbidden` (`NOT_OWNER`).
7. **Uniform Error Format**:
   - Every 4xx/5xx response returns JSON `{ "code": "<STABLE_CODE>", "message": "<human readable message>" }`.
   - Stable error codes: `VALIDATION_ERROR` (400), `NOT_OWNER` (403), `NOT_FOUND` (404), `SEATS_FULL` (409), `ALREADY_APPLIED` (409), `HOLD_EXPIRED` (409), `HOLD_CANCELLED` (409), `ALREADY_CONFIRMED` (409), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).
8. **Extra Fields on Hold Responses (`serverTime`, `className`)**:
   - The spec explicitly allows extra response fields as long as required fields are unchanged. Hold responses include `serverTime` (ISO-8601 UTC from PostgreSQL's clock) and `className` so the frontend can compute countdown timers immune to a skewed client clock. The HTTP `Date` header is also exposed via CORS.
9. **No Authentication / Login**:
   - As specified, there is no login for either school admins or guardians. The UI provides the Admin "Create Class" form and the Student ID bar on a single page, polling every 4 seconds (`POLL_INTERVAL_MS = 4000`).

---

## 2. How the Seat Limit Is Guaranteed Across Multiple Processes

All concurrency and seat-limit invariants live inside **PostgreSQL**, with zero reliance on in-memory locks or counters:

1. **Per-Class Row Lock (`SELECT ... FROM classes WHERE id = @id FOR UPDATE`)**:
   - Every `POST /classes/{classId}/holds` runs inside a PostgreSQL transaction that first acquires an exclusive row lock on the target `classes` row.
   - Concurrent requests for the same class—whether from 200 threads in one process or spread across `backend` (port 8080) and `backend2` (port 8081)—serialize cleanly on that row lock in PostgreSQL.
2. **Single Source of Truth for Time (PostgreSQL Clock)**:
   - Hold expiry timestamps (`expires_at`) and all expiry comparisons use PostgreSQL's clock (`clock_timestamp()` / `now()`), never `DateTime.UtcNow` on an application server. Multiple backend processes therefore agree on exact expiry boundaries.
3. **In-Transaction Expiry Materialization & Seat Count Check**:
   - While holding the `classes` row lock, the transaction:
     1. Updates any `HELD` rows for that class with `expires_at <= clock_timestamp()` to `EXPIRED`.
     2. Checks whether the student already has a `HELD` or `CONFIRMED` row in that class (`409 ALREADY_APPLIED` if so).
     3. Counts `HELD` + `CONFIRMED` rows for that class and rejects with `409 SEATS_FULL` if `count >= total_seats`.
     4. Inserts the new `HELD` row and commits.
4. **Partial Unique Index Safety Net**:
   - The database enforces `CREATE UNIQUE INDEX ux_holds_active_student_class ON holds (class_id, student_id) WHERE status IN ('HELD', 'CONFIRMED')`, guaranteeing at the storage layer that a student can never hold or confirm more than one seat per class at a time, while still allowing re-application after `EXPIRED` or `CANCELLED`.
5. **Lock Ordering & Idempotent Confirm/Cancel**:
   - `Apply` locks `classes` then inserts into `holds`. `Confirm` and `Cancel` only lock the single `holds` row (`SELECT ... FROM holds WHERE id = @id FOR UPDATE`) because transitioning `HELD -> CONFIRMED` does not increase `held + confirmed`.
   - The background `HoldExpirySweeper` uses `FOR UPDATE SKIP LOCKED` so it never blocks or deadlocks with active transactions.
6. **Effective-Status Reads**:
   - `GET /classes`, `GET /classes/{id}`, `GET /holds/{id}`, and `GET /me/holds` compute effective status on read (`h.status = 'HELD' AND h.expires_at > now()`), so seat availability and hold status are immediately accurate the millisecond a hold expires, even before the background sweeper runs.
7. **Startup Migration Advisory Lock**:
   - On startup, `DbMigrator` acquires `pg_advisory_lock(74023110001)` before creating/updating schema objects, so multiple backend containers booting simultaneously never race on DDL.

