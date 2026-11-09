using System.Data;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// All seat-related correctness lives in PostgreSQL (row locks, DB clock, partial unique index),
/// never in process memory, so the guarantees hold across any number of backend processes.
/// </summary>
public sealed class HoldService(NpgsqlDataSource dataSource, AdmissionSettings settings, ILogger<HoldService> logger)
{
    private const string UniqueViolation = "23505";
    private const string DeadlockDetected = "40P01";
    private const string SerializationFailure = "40001";
    private const int MaxTransientRetries = 3;

    // Effective status: a HELD row past its expiry is reported as EXPIRED even if the sweeper has
    // not rewritten it yet.
    private const string HoldSelectSql = """
        SELECT h.id, h.class_id, c.name,
               CASE WHEN h.status = 'HELD' AND h.expires_at <= now() THEN 'EXPIRED' ELSE h.status END AS status,
               h.expires_at, now() AS server_time
        FROM holds h
        JOIN classes c ON c.id = h.class_id
        """;

    // ---------------------------------------------------------------- apply (POST /classes/{id}/holds)

    public async Task<CreateHoldResponse> ApplyAsync(string rawClassId, string studentId, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await ApplyOnceAsync(classId, studentId, ct);
            }
            catch (PostgresException ex) when (ex.SqlState is DeadlockDetected or SerializationFailure && attempt < MaxTransientRetries)
            {
                logger.LogWarning("Transient database conflict ({SqlState}) while applying, retrying.", ex.SqlState);
            }
        }
    }

    private async Task<CreateHoldResponse> ApplyOnceAsync(long classId, string studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 0) Per-student lock (taken BEFORE the class lock, always in this order, so no deadlock cycle is
        //    possible). It serialises one student's parallel applications to *different* classes, which the
        //    per-class row lock below cannot do on its own.
        if (settings.SingleAdmissionPerStudent)
        {
            await using var lockCmd = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtext('student:' || @sid))", conn, tx);
            lockCmd.Parameters.AddWithValue("sid", studentId);
            await lockCmd.ExecuteNonQueryAsync(ct);
        }

        // a) Lock the class row. Every applicant for this class queues here, across all processes.
        string className;
        int totalSeats;
        string classStatus;
        await using (var cmd = new NpgsqlCommand(
                         "SELECT name, total_seats, status FROM classes WHERE id = @id FOR UPDATE", conn, tx))
        {
            cmd.Parameters.AddWithValue("id", classId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Class not found.");
            className = r.GetString(0);
            totalSeats = r.GetInt32(1);
            classStatus = r.GetString(2);
        }

        if (!string.Equals(classStatus, "OPEN", StringComparison.OrdinalIgnoreCase))
            throw ApiException.Conflict(ErrorCodes.ClassClosed, "Admissions for this class-shift are currently closed.");

        // b) Materialise expiries for this class (uses the DB clock, after the lock was acquired).
        await using (var cmd = new NpgsqlCommand("""
                         UPDATE holds SET status = 'EXPIRED'
                         WHERE class_id = @id AND status = 'HELD' AND expires_at <= clock_timestamp()
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", classId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // c) + d) One active hold per student per class, and the seat limit.
        long taken, mine;
        await using (var cmd = new NpgsqlCommand("""
                         SELECT COUNT(*),
                                COUNT(*) FILTER (WHERE student_id = @sid)
                         FROM holds
                         WHERE class_id = @id AND status IN ('HELD', 'CONFIRMED')
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", classId);
            cmd.Parameters.AddWithValue("sid", studentId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            taken = r.GetInt64(0);
            mine = r.GetInt64(1);
        }

        if (mine > 0)
            throw ApiException.Conflict(ErrorCodes.AlreadyApplied,
                "This student already has an active or confirmed application for this class.");

        // c2) One admission per student across ALL classes / shifts (Morning vs Day, Class 6 vs Class 7).
        if (settings.SingleAdmissionPerStudent)
        {
            await using var otherCmd = new NpgsqlCommand("""
                SELECT c.name, h.status
                FROM holds h
                JOIN classes c ON c.id = h.class_id
                WHERE h.student_id = @sid
                  AND h.class_id <> @id
                  AND (h.status = 'CONFIRMED' OR (h.status = 'HELD' AND h.expires_at > clock_timestamp()))
                ORDER BY (h.status = 'CONFIRMED') DESC, h.created_at
                LIMIT 1
                """, conn, tx);
            otherCmd.Parameters.AddWithValue("id", classId);
            otherCmd.Parameters.AddWithValue("sid", studentId);
            await using var r = await otherCmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                var otherClass = r.GetString(0);
                var otherStatus = r.GetString(1);
                throw ApiException.Conflict(ErrorCodes.AlreadyAdmittedElsewhere, otherStatus == "CONFIRMED"
                    ? $"This student is already admitted to '{otherClass}'. A student cannot be enrolled in two classes or shifts at the same time."
                    : $"This student already holds a seat in '{otherClass}'. Cancel that hold first; a student cannot apply to two classes or shifts at the same time.");
            }
        }

        if (taken >= totalSeats)
            throw ApiException.Conflict(ErrorCodes.SeatsFull, "No seats are available in this class.");

        // e) Insert the hold. expires_at is computed from the DB clock so every process agrees.
        long holdId;
        DateTime expiresAt, serverTime;
        try
        {
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO holds (class_id, student_id, status, created_at, expires_at)
                VALUES (@id, @sid, 'HELD', clock_timestamp(),
                        date_trunc('milliseconds', clock_timestamp() + make_interval(secs => @secs)))
                RETURNING id, expires_at, clock_timestamp()
                """, conn, tx);
            cmd.Parameters.AddWithValue("id", classId);
            cmd.Parameters.AddWithValue("sid", studentId);
            cmd.Parameters.AddWithValue("secs", (double)settings.HoldDurationSeconds);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            holdId = r.GetInt64(0);
            expiresAt = r.GetDateTime(1);
            serverTime = r.GetDateTime(2);
        }
        catch (PostgresException ex) when (ex.SqlState == UniqueViolation)
        {
            // Second safety net (partial unique index); should be unreachable thanks to the class lock.
            throw ApiException.Conflict(ErrorCodes.AlreadyApplied,
                "This student already has an active or confirmed application for this class.");
        }

        await using (var profileCmd = new NpgsqlCommand(
                         "INSERT INTO student_profiles (student_id) VALUES (@sid) ON CONFLICT (student_id) DO NOTHING", conn, tx))
        {
            profileCmd.Parameters.AddWithValue("sid", studentId);
            await profileCmd.ExecuteNonQueryAsync(ct);
        }

        await using (var notifCmd = new NpgsqlCommand("""
            INSERT INTO notifications (recipient_type, recipient_id, category, severity, title, message, actor, created_at)
            VALUES ('PARENT', @sid, 'SEAT_HOLD', 'SUCCESS', 'Seat Hold Secured',
                    'Temporary hold secured for ' || @cname || '. Complete your admission fee payment within 10 minutes to confirm your seat.',
                    @actor, clock_timestamp()),
                   ('ALL_ADMINS', NULL, 'SEAT_HOLD', 'INFO', 'New Seat Hold Placed',
                    'Student ' || @sid || ' placed a hold for ' || @cname || ' (Hold ID: h_' || @hid || ').',
                    @actor, clock_timestamp())
            """, conn, tx))
        {
            notifCmd.Parameters.AddWithValue("sid", studentId);
            notifCmd.Parameters.AddWithValue("cname", className);
            notifCmd.Parameters.AddWithValue("hid", holdId);
            notifCmd.Parameters.AddWithValue("actor", "Student " + studentId);
            await notifCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);

        return new CreateHoldResponse(Ids.Hold(holdId), Ids.Class(classId), studentId, HoldStatus.Held,
            Iso.Format(expiresAt), className, Iso.Format(serverTime));
    }

    // ---------------------------------------------------------------- confirm (POST /holds/{id}/confirm)

    public async Task<ConfirmHoldResponse> ConfirmAsync(string rawHoldId, string studentId, CancellationToken ct)
    {
        var holdId = Ids.ParseHoldOr404(rawHoldId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var hold = await LockHoldAsync(conn, tx, holdId, ct);
        if (hold.StudentId != studentId) throw ApiException.NotOwner();

        switch (hold.Status)
        {
            case HoldStatus.Confirmed:
                // Idempotent: nothing changes, confirmedSeats was already incremented once.
                await EnsurePaymentRecordAsync(conn, tx, hold.Id, hold.ClassId, hold.StudentId, ct);
                await tx.CommitAsync(ct);
                return ToConfirmResponse(hold, hold.ConfirmedAt, hold.Now);
            case HoldStatus.Cancelled:
                throw ApiException.Conflict(ErrorCodes.HoldCancelled, "This application was cancelled and can no longer be confirmed.");
            case HoldStatus.Expired:
                throw ApiException.Conflict(ErrorCodes.HoldExpired, "This application has expired. Please apply again.");
        }

        if (hold.IsPastExpiry)
        {
            await MarkExpiredAsync(conn, tx, holdId, ct);
            await tx.CommitAsync(ct);
            throw ApiException.Conflict(ErrorCodes.HoldExpired, "This application has expired. Please apply again.");
        }

        // HELD -> CONFIRMED does not change held+confirmed, so no class lock is needed.
        DateTime confirmedAt;
        await using (var cmd = new NpgsqlCommand("""
                         UPDATE holds SET status = 'CONFIRMED', confirmed_at = clock_timestamp()
                         WHERE id = @id
                         RETURNING confirmed_at
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("id", holdId);
            confirmedAt = (DateTime)(await cmd.ExecuteScalarAsync(ct))!;
        }

        await EnsurePaymentRecordAsync(conn, tx, holdId, hold.ClassId, hold.StudentId, ct);

        await using (var notifCmd = new NpgsqlCommand("""
            INSERT INTO notifications (recipient_type, recipient_id, category, severity, title, message, actor, created_at)
            VALUES ('PARENT', @sid, 'PAYMENT', 'SUCCESS', 'Admission Confirmed & Fee Paid',
                    'Admission fee received and seat confirmed for ' || @cname || '! Receipt generated.',
                    'Finance Office', clock_timestamp()),
                   ('ALL_ADMINS', NULL, 'PAYMENT', 'SUCCESS', 'Admission Fee Paid',
                    'Student ' || @sid || ' paid admission fee for ' || @cname || '. Receipt generated.',
                    @actor, clock_timestamp())
            """, conn, tx))
        {
            notifCmd.Parameters.AddWithValue("sid", hold.StudentId);
            notifCmd.Parameters.AddWithValue("cname", hold.ClassName);
            notifCmd.Parameters.AddWithValue("actor", "Student " + hold.StudentId);
            await notifCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
        return ToConfirmResponse(hold, confirmedAt, confirmedAt);
    }

    private static async Task EnsurePaymentRecordAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, long holdId, long classId, string studentId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO payments (
                hold_id, class_id, student_id, receipt_no,
                gross_amount, discount_amount, discount_reason, net_amount,
                gateway, status, paid_at
            )
            SELECT
                @hid,
                c.id,
                @sid,
                'RCP-' || c.academic_year || '-' || lpad(@hid::text, 5, '0'),
                (c.admission_fee + c.session_charge + c.development_fee + c.security_deposit + c.first_month_tuition) AS gross,
                CASE WHEN COALESCE(sp.has_sibling, FALSE) THEN ROUND(c.admission_fee * 0.10, 2) ELSE 0 END AS disc,
                CASE WHEN COALESCE(sp.has_sibling, FALSE) THEN 'Automatic Sibling Concession (10% on Admission Fee)' ELSE '' END AS reason,
                (c.admission_fee + c.session_charge + c.development_fee + c.security_deposit + c.first_month_tuition)
                    - CASE WHEN COALESCE(sp.has_sibling, FALSE) THEN ROUND(c.admission_fee * 0.10, 2) ELSE 0 END AS net,
                'MOCK_GATEWAY',
                'SUCCESS',
                clock_timestamp()
            FROM classes c
            LEFT JOIN student_profiles sp ON sp.student_id = @sid
            WHERE c.id = @cid
            ON CONFLICT (hold_id) DO NOTHING
            """, conn, tx);
        cmd.Parameters.AddWithValue("hid", holdId);
        cmd.Parameters.AddWithValue("cid", classId);
        cmd.Parameters.AddWithValue("sid", studentId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // ---------------------------------------------------------------- cancel (DELETE /holds/{id})

    public async Task CancelAsync(string rawHoldId, string studentId, CancellationToken ct)
    {
        var holdId = Ids.ParseHoldOr404(rawHoldId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var hold = await LockHoldAsync(conn, tx, holdId, ct);
        if (hold.StudentId != studentId) throw ApiException.NotOwner();

        switch (hold.Status)
        {
            case HoldStatus.Cancelled:
                await tx.CommitAsync(ct); // idempotent
                return;
            case HoldStatus.Confirmed:
                throw ApiException.Conflict(ErrorCodes.AlreadyConfirmed,
                    "A confirmed admission cannot be cancelled here (refunds are handled by the school office).");
            case HoldStatus.Expired:
                throw ApiException.Conflict(ErrorCodes.HoldExpired, "This application has already expired.");
        }

        if (hold.IsPastExpiry)
        {
            await MarkExpiredAsync(conn, tx, holdId, ct);
            await tx.CommitAsync(ct);
            throw ApiException.Conflict(ErrorCodes.HoldExpired, "This application has already expired.");
        }

        await using (var cmd = new NpgsqlCommand(
                         "UPDATE holds SET status = 'CANCELLED', cancelled_at = clock_timestamp() WHERE id = @id", conn, tx))
        {
            cmd.Parameters.AddWithValue("id", holdId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        await using (var notifCmd = new NpgsqlCommand("""
            INSERT INTO notifications (recipient_type, recipient_id, category, severity, title, message, actor, created_at)
            VALUES ('PARENT', @sid, 'SEAT_HOLD', 'WARNING', 'Seat Hold Cancelled',
                    'Your hold for ' || @cname || ' was cancelled and the seat returned to the pool.',
                    @actor, clock_timestamp()),
                   ('ALL_ADMINS', NULL, 'SEAT_HOLD', 'INFO', 'Seat Hold Released',
                    'Student ' || @sid || ' cancelled hold h_' || @hid || ' for ' || @cname || '. 1 seat reopened.',
                    @actor, clock_timestamp())
            """, conn, tx))
        {
            notifCmd.Parameters.AddWithValue("sid", hold.StudentId);
            notifCmd.Parameters.AddWithValue("cname", hold.ClassName);
            notifCmd.Parameters.AddWithValue("hid", hold.Id);
            notifCmd.Parameters.AddWithValue("actor", "Student " + hold.StudentId);
            await notifCmd.ExecuteNonQueryAsync(ct);
        }

        await tx.CommitAsync(ct);
    }

    // ---------------------------------------------------------------- reads

    public async Task<HoldResponse> GetAsync(string rawHoldId, CancellationToken ct)
    {
        var holdId = Ids.ParseHoldOr404(rawHoldId);
        await using var cmd = dataSource.CreateCommand(HoldSelectSql + " WHERE h.id = @id");
        cmd.Parameters.AddWithValue("id", holdId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Application (hold) not found.");
        return ReadHold(r);
    }

    public async Task<IReadOnlyList<HoldResponse>> ListForStudentAsync(string studentId, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand(
            HoldSelectSql + " WHERE h.student_id = @sid ORDER BY h.created_at DESC, h.id DESC");
        cmd.Parameters.AddWithValue("sid", studentId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<HoldResponse>();
        while (await r.ReadAsync(ct)) list.Add(ReadHold(r));
        return list;
    }

    // ---------------------------------------------------------------- helpers

    private sealed record LockedHold(
        long Id, long ClassId, string ClassName, string StudentId, string Status, DateTime ExpiresAt,
        DateTime? ConfirmedAt, bool IsPastExpiry, DateTime Now);

    private static async Task<LockedHold> LockHoldAsync(NpgsqlConnection conn, NpgsqlTransaction tx, long holdId, CancellationToken ct)
    {
        // FOR UPDATE serialises concurrent confirm/cancel calls on the same hold (makes confirm idempotent).
        await using var cmd = new NpgsqlCommand("""
            SELECT h.id, h.class_id, c.name, h.student_id, h.status, h.expires_at, h.confirmed_at,
                   h.expires_at <= clock_timestamp() AS past_expiry, clock_timestamp() AS now
            FROM holds h
            JOIN classes c ON c.id = h.class_id
            WHERE h.id = @id
            FOR UPDATE OF h
            """, conn, tx);
        cmd.Parameters.AddWithValue("id", holdId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Application (hold) not found.");
        return new LockedHold(
            r.GetInt64(0), r.GetInt64(1), r.GetString(2), r.GetString(3).Trim(), r.GetString(4), r.GetDateTime(5),
            r.IsDBNull(6) ? null : r.GetDateTime(6), r.GetBoolean(7), r.GetDateTime(8));
    }

    private static async Task MarkExpiredAsync(NpgsqlConnection conn, NpgsqlTransaction tx, long holdId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "UPDATE holds SET status = 'EXPIRED' WHERE id = @id AND status = 'HELD'", conn, tx);
        cmd.Parameters.AddWithValue("id", holdId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static ConfirmHoldResponse ToConfirmResponse(LockedHold hold, DateTime? confirmedAt, DateTime now) =>
        new(Ids.Hold(hold.Id), HoldStatus.Confirmed, Ids.Class(hold.ClassId), Iso.Format(hold.ExpiresAt),
            confirmedAt is null ? null : Iso.Format(confirmedAt.Value), Iso.Format(now));

    private static HoldResponse ReadHold(NpgsqlDataReader r) =>
        new(Ids.Hold(r.GetInt64(0)), Ids.Class(r.GetInt64(1)), r.GetString(2), r.GetString(3),
            Iso.Format(r.GetDateTime(4)), Iso.Format(r.GetDateTime(5)));
}
