using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

public sealed class PortalService(
    NpgsqlDataSource dataSource,
    AdmissionSettings settings,
    HoldService holdService,
    IConfiguration configuration)
{
    private static readonly (string Type, string Label)[] DefaultDocumentSlots =
    [
        ("BIRTH_CERT",     "Birth Registration Certificate (17-Digit)"),
        ("STUDENT_PHOTO",  "Student Passport Size Photograph"),
        ("PARENTS_NID",    "Father & Mother National ID (NID) Copies"),
        ("PREV_SCHOOL_TC", "Previous School Transfer Certificate & Report Card"),
        ("INCOME_PROOF",   "Household Income Certificate (Required for Concession)")
    ];

    // Admin authentication & session management

    public async Task<AdminSessionResponse> LoginAdminAsync(AdminLoginRequest req, CancellationToken ct)
    {
        var username = string.IsNullOrWhiteSpace(req.Username) ? "admin" : req.Username.Trim().ToLowerInvariant();
        var password = req.Password ?? string.Empty;
        if (string.IsNullOrWhiteSpace(password))
            throw ApiException.InvalidCredentials("Password is required.");

        await using var conn = await dataSource.OpenConnectionAsync(ct);

        string? dbHash = null;
        string? role = null;
        string? fullName = null;

        await using (var cmd = new NpgsqlCommand(
                         "SELECT password_hash, role, full_name FROM admin_users WHERE username = @u", conn))
        {
            cmd.Parameters.AddWithValue("u", username);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                dbHash = r.GetString(0);
                role = r.GetString(1);
                fullName = r.GetString(2);
            }
        }

        var envAdminPassword = configuration["ADMIN_PASSWORD"];
        var inputHash = DbMigrator.HashPassword(password);
        var validPassword = (dbHash is not null && string.Equals(dbHash, inputHash, StringComparison.OrdinalIgnoreCase))
                            || (username == "admin" && !string.IsNullOrWhiteSpace(envAdminPassword) && password == envAdminPassword);

        if (!validPassword || role is null || fullName is null)
            throw ApiException.InvalidCredentials("Invalid admin username or password.");

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        DateTime expiresAt;
        await using (var ins = new NpgsqlCommand("""
                         INSERT INTO admin_sessions (token, username, role, full_name, created_at, expires_at)
                         VALUES (@t, @u, @r, @f, clock_timestamp(), clock_timestamp() + interval '24 hours')
                         RETURNING expires_at
                         """, conn))
        {
            ins.Parameters.AddWithValue("t", token);
            ins.Parameters.AddWithValue("u", username);
            ins.Parameters.AddWithValue("r", role);
            ins.Parameters.AddWithValue("f", fullName);
            expiresAt = (DateTime)(await ins.ExecuteScalarAsync(ct))!;
        }

        await WriteAuditAsync(conn, null, username, role, "ADMIN_LOGIN", "admin_users", username,
            $"Admin '{username}' ({role}) signed in.", ct);

        return new AdminSessionResponse(token, username, role, fullName, Iso.Format(expiresAt));
    }

    public async Task<AdminSessionResponse> RequireAdminAsync(HttpRequest request, CancellationToken ct)
    {
        var token = ExtractAdminToken(request);
        if (string.IsNullOrWhiteSpace(token))
            throw ApiException.Unauthorized("Admin login required. Please sign in at /admin.");

        await using var cmd = dataSource.CreateCommand("""
            SELECT token, username, role, full_name, expires_at
            FROM admin_sessions
            WHERE token = @t AND expires_at > clock_timestamp()
            """);
        cmd.Parameters.AddWithValue("t", token);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct))
            throw ApiException.Unauthorized("Your admin session has expired or is invalid. Please sign in again.");

        return new AdminSessionResponse(
            r.GetString(0),
            r.GetString(1),
            r.GetString(2),
            r.GetString(3),
            Iso.Format(r.GetDateTime(4)));
    }

    public async Task LogoutAdminAsync(HttpRequest request, CancellationToken ct)
    {
        var token = ExtractAdminToken(request);
        if (string.IsNullOrWhiteSpace(token)) return;

        await using var cmd = dataSource.CreateCommand("DELETE FROM admin_sessions WHERE token = @t");
        cmd.Parameters.AddWithValue("t", token);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static string? ExtractAdminToken(HttpRequest request)
    {
        if (request.Headers.TryGetValue("X-Admin-Token", out var custom) && !string.IsNullOrWhiteSpace(custom))
            return custom.ToString().Trim();

        if (request.Headers.TryGetValue("Authorization", out var auth))
        {
            var raw = auth.ToString().Trim();
            if (raw.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return raw["Bearer ".Length..].Trim();
        }
        return null;
    }

    // Parent portal operations: child profile, documents, fee breakdown & waitlist

    public async Task<StudentProfileDto> GetStudentProfileAsync(string studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await EnsureProfileRowAsync(conn, null, studentId, ct);
        return await ReadProfileAsync(conn, null, studentId, ct);
    }

    public async Task<StudentProfileDto> SaveStudentProfileAsync(
        string studentId, SaveStudentProfileRequest req, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await EnsureProfileRowAsync(conn, tx, studentId, ct);
        var existing = await ReadProfileAsync(conn, tx, studentId, ct);

        var nextConcessionReq = req.ConcessionRequested ?? existing.ConcessionRequested;
        var nextConcessionStatus = existing.ConcessionStatus;
        if (nextConcessionReq && nextConcessionStatus == "NONE")
            nextConcessionStatus = "PENDING";
        else if (!nextConcessionReq && nextConcessionStatus == "PENDING")
            nextConcessionStatus = "NONE";

        var nextAppStatus = existing.ApplicationStatus;
        if (req.SubmitForReview == true && nextAppStatus is "DRAFT" or "NEEDS_CORRECTION")
            nextAppStatus = "SUBMITTED";

        await using (var cmd = new NpgsqlCommand("""
                         UPDATE student_profiles SET
                             full_name_en         = @full_name_en,
                             full_name_bn         = @full_name_bn,
                             dob                  = @dob,
                             gender               = @gender,
                             nationality          = @nationality,
                             religion             = @religion,
                             blood_group          = @blood_group,
                             present_address      = @present_address,
                             permanent_address    = @permanent_address,
                             previous_school      = @previous_school,
                             last_class_passed    = @last_class_passed,
                             last_result          = @last_result,
                             health_notes         = @health_notes,
                             has_sibling          = @has_sibling,
                             sibling_name         = @sibling_name,
                             sibling_class        = @sibling_class,
                             sibling_student_id   = @sibling_student_id,
                             father_name          = @father_name,
                             father_nid           = @father_nid,
                             father_occupation    = @father_occupation,
                             father_employer      = @father_employer,
                             father_phone         = @father_phone,
                             father_email         = @father_email,
                             mother_name          = @mother_name,
                             mother_nid           = @mother_nid,
                             mother_occupation    = @mother_occupation,
                             mother_employer      = @mother_employer,
                             mother_phone         = @mother_phone,
                             mother_email         = @mother_email,
                             guardian_name        = @guardian_name,
                             guardian_relation    = @guardian_relation,
                             guardian_phone       = @guardian_phone,
                             emergency_contact    = @emergency_contact,
                             monthly_income       = @monthly_income,
                             income_bracket       = @income_bracket,
                             income_source        = @income_source,
                             dependents           = @dependents,
                             concession_requested = @concession_requested,
                             concession_status    = @concession_status,
                             application_status   = @application_status,
                             updated_at           = clock_timestamp()
                         WHERE student_id = @sid
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("sid", studentId);
            cmd.Parameters.AddWithValue("full_name_en", (req.FullNameEn ?? existing.FullNameEn).Trim());
            cmd.Parameters.AddWithValue("full_name_bn", (req.FullNameBn ?? existing.FullNameBn).Trim());
            cmd.Parameters.AddWithValue("dob", (req.Dob ?? existing.Dob).Trim());
            cmd.Parameters.AddWithValue("gender", (req.Gender ?? existing.Gender).Trim());
            cmd.Parameters.AddWithValue("nationality", (req.Nationality ?? existing.Nationality).Trim());
            cmd.Parameters.AddWithValue("religion", (req.Religion ?? existing.Religion).Trim());
            cmd.Parameters.AddWithValue("blood_group", (req.BloodGroup ?? existing.BloodGroup).Trim());
            cmd.Parameters.AddWithValue("present_address", (req.PresentAddress ?? existing.PresentAddress).Trim());
            cmd.Parameters.AddWithValue("permanent_address", (req.PermanentAddress ?? existing.PermanentAddress).Trim());
            cmd.Parameters.AddWithValue("previous_school", (req.PreviousSchool ?? existing.PreviousSchool).Trim());
            cmd.Parameters.AddWithValue("last_class_passed", (req.LastClassPassed ?? existing.LastClassPassed).Trim());
            cmd.Parameters.AddWithValue("last_result", (req.LastResult ?? existing.LastResult).Trim());
            cmd.Parameters.AddWithValue("health_notes", (req.HealthNotes ?? existing.HealthNotes).Trim());
            cmd.Parameters.AddWithValue("has_sibling", req.HasSibling ?? existing.HasSibling);
            cmd.Parameters.AddWithValue("sibling_name", (req.SiblingName ?? existing.SiblingName).Trim());
            cmd.Parameters.AddWithValue("sibling_class", (req.SiblingClass ?? existing.SiblingClass).Trim());
            cmd.Parameters.AddWithValue("sibling_student_id", (req.SiblingStudentId ?? existing.SiblingStudentId).Trim());
            cmd.Parameters.AddWithValue("father_name", (req.FatherName ?? existing.FatherName).Trim());
            cmd.Parameters.AddWithValue("father_nid", (req.FatherNid ?? existing.FatherNid).Trim());
            cmd.Parameters.AddWithValue("father_occupation", (req.FatherOccupation ?? existing.FatherOccupation).Trim());
            cmd.Parameters.AddWithValue("father_employer", (req.FatherEmployer ?? existing.FatherEmployer).Trim());
            cmd.Parameters.AddWithValue("father_phone", (req.FatherPhone ?? existing.FatherPhone).Trim());
            cmd.Parameters.AddWithValue("father_email", (req.FatherEmail ?? existing.FatherEmail).Trim());
            cmd.Parameters.AddWithValue("mother_name", (req.MotherName ?? existing.MotherName).Trim());
            cmd.Parameters.AddWithValue("mother_nid", (req.MotherNid ?? existing.MotherNid).Trim());
            cmd.Parameters.AddWithValue("mother_occupation", (req.MotherOccupation ?? existing.MotherOccupation).Trim());
            cmd.Parameters.AddWithValue("mother_employer", (req.MotherEmployer ?? existing.MotherEmployer).Trim());
            cmd.Parameters.AddWithValue("mother_phone", (req.MotherPhone ?? existing.MotherPhone).Trim());
            cmd.Parameters.AddWithValue("mother_email", (req.MotherEmail ?? existing.MotherEmail).Trim());
            cmd.Parameters.AddWithValue("guardian_name", (req.GuardianName ?? existing.GuardianName).Trim());
            cmd.Parameters.AddWithValue("guardian_relation", (req.GuardianRelation ?? existing.GuardianRelation).Trim());
            cmd.Parameters.AddWithValue("guardian_phone", (req.GuardianPhone ?? existing.GuardianPhone).Trim());
            cmd.Parameters.AddWithValue("emergency_contact", (req.EmergencyContact ?? existing.EmergencyContact).Trim());
            cmd.Parameters.AddWithValue("monthly_income", Math.Max(0, req.MonthlyIncome ?? existing.MonthlyIncome));
            cmd.Parameters.AddWithValue("income_bracket", (req.IncomeBracket ?? existing.IncomeBracket).Trim());
            cmd.Parameters.AddWithValue("income_source", (req.IncomeSource ?? existing.IncomeSource).Trim());
            cmd.Parameters.AddWithValue("dependents", Math.Max(1, req.Dependents ?? existing.Dependents));
            cmd.Parameters.AddWithValue("concession_requested", nextConcessionReq);
            cmd.Parameters.AddWithValue("concession_status", nextConcessionStatus);
            cmd.Parameters.AddWithValue("application_status", nextAppStatus);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        var updated = await ReadProfileAsync(conn, tx, studentId, ct);

        await AddNotificationAsync(conn, tx, "PARENT", studentId, "DOCUMENT", "INFO", "Profile Dossier Saved",
            "Child profile and guardian details were successfully saved.", "Guardian", ct);
        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "DOCUMENT", "INFO", "Profile Dossier Updated",
            $"Parent updated dossier details for student {studentId}.", $"Parent ({studentId})", ct);

        await tx.CommitAsync(ct);
        return updated;
    }

    public async Task<StudentProfileDto> UploadDocumentAsync(
        string studentId, UploadDocumentRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Type))
            throw ApiException.Validation("Document type is required.");
        if (string.IsNullOrWhiteSpace(req.FileName))
            throw ApiException.Validation("File name is required.");

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await EnsureProfileRowAsync(conn, tx, studentId, ct);
        var profile = await ReadProfileAsync(conn, tx, studentId, ct);

        var type = req.Type.Trim().ToUpperInvariant();
        var defaultSlot = DefaultDocumentSlots.FirstOrDefault(s => s.Type == type);
        var label = !string.IsNullOrWhiteSpace(req.Label)
            ? req.Label.Trim()
            : (defaultSlot.Label ?? type);

        var updatedDocs = profile.Documents
            .Select(d => d.Type == type
                ? new DocumentItemDto(type, label, req.FileName.Trim(), Math.Max(1, req.FileSize), Iso.Format(DateTime.UtcNow), "PENDING", "")
                : d)
            .ToList();

        if (updatedDocs.All(d => d.Type != type))
        {
            updatedDocs.Add(new DocumentItemDto(
                type, label, req.FileName.Trim(), Math.Max(1, req.FileSize), Iso.Format(DateTime.UtcNow), "PENDING", ""));
        }

        await SaveDocumentsJsonAsync(conn, tx, studentId, updatedDocs, ct);
        var result = await ReadProfileAsync(conn, tx, studentId, ct);

        await AddNotificationAsync(conn, tx, "PARENT", studentId, "DOCUMENT", "SUCCESS", "Document Uploaded",
            $"Document '{label}' was uploaded and is pending officer verification.", "Guardian", ct);
        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "DOCUMENT", "INFO", "Document Uploaded",
            $"Student {studentId} uploaded document {label} ({type}).", $"Parent ({studentId})", ct);

        await tx.CommitAsync(ct);
        return result;
    }

    public async Task<ClassFeeBreakdownDto> GetClassFeeBreakdownAsync(
        string rawClassId, string? studentId, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);

        string name, shift, year;
        decimal adm, sess, dev, sec, firstMonth, monthly, exam, lab;

        await using (var cmd = new NpgsqlCommand("""
                         SELECT name, shift, academic_year,
                                admission_fee, session_charge, development_fee, security_deposit,
                                first_month_tuition, monthly_tuition, exam_fee, lab_fee
                         FROM classes WHERE id = @id
                         """, conn))
        {
            cmd.Parameters.AddWithValue("id", classId);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Class not found.");
            name = r.GetString(0);
            shift = r.GetString(1);
            year = r.GetString(2);
            adm = r.GetDecimal(3);
            sess = r.GetDecimal(4);
            dev = r.GetDecimal(5);
            sec = r.GetDecimal(6);
            firstMonth = r.GetDecimal(7);
            monthly = r.GetDecimal(8);
            exam = r.GetDecimal(9);
            lab = r.GetDecimal(10);
        }

        bool hasSibling = false;
        if (!string.IsNullOrWhiteSpace(studentId) && StudentIds.IsValid(studentId))
        {
            await using var sibCmd = new NpgsqlCommand(
                "SELECT has_sibling FROM student_profiles WHERE student_id = @sid", conn);
            sibCmd.Parameters.AddWithValue("sid", studentId);
            var res = await sibCmd.ExecuteScalarAsync(ct);
            if (res is bool b) hasSibling = b;
        }

        var heads = new List<FeeLineItemDto>
        {
            new("Admission fee",       "One-time", adm,        false, true),
            new("Session charge",      "Annual",   sess,       false, true),
            new("Development fee",     "One-time", dev,        false, true),
            new("Security deposit",    "One-time", sec,        true,  true),
            new("First month tuition", "Monthly",  firstMonth, false, true),
            new("Monthly tuition (from month 2)", "Monthly", monthly, false, false),
            new("Exam fee",            "Per term", exam,       false, false),
            new("Lab / ICT fee",       "Monthly",  lab,        false, false),
        };

        var gross = adm + sess + dev + sec + firstMonth;
        var discount = hasSibling ? Math.Round(adm * 0.10m, 2) : 0m;
        var reason = hasSibling ? "Automatic Sibling Concession (10% on Admission Fee)" : null;
        var net = gross - discount;

        return new ClassFeeBreakdownDto(
            Ids.Class(classId), name, shift, year, heads,
            gross, discount, reason, net, monthly + lab);
    }

    public async Task<IReadOnlyList<PaymentRecordDto>> ListStudentPaymentsAsync(string studentId, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            SELECT p.id, p.hold_id, p.class_id, c.name, p.student_id,
                   COALESCE(sp.full_name_en, ''),
                   p.receipt_no, p.gross_amount, p.discount_amount, p.discount_reason,
                   p.net_amount, p.gateway, p.status, p.refunded_amount, p.refund_reason, p.paid_at
            FROM payments p
            JOIN classes c ON c.id = p.class_id
            LEFT JOIN student_profiles sp ON sp.student_id = p.student_id
            WHERE p.student_id = @sid
            ORDER BY p.paid_at DESC, p.id DESC
            """);
        cmd.Parameters.AddWithValue("sid", studentId);
        return await ReadPaymentsAsync(cmd, ct);
    }

    public async Task<WaitlistEntryDto> JoinWaitlistAsync(string rawClassId, string studentId, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);

        string className;
        await using (var checkCmd = new NpgsqlCommand("SELECT name FROM classes WHERE id = @id", conn))
        {
            checkCmd.Parameters.AddWithValue("id", classId);
            var n = await checkCmd.ExecuteScalarAsync(ct);
            if (n is null) throw ApiException.NotFound("Class not found.");
            className = (string)n;
        }

        await EnsureProfileRowAsync(conn, null, studentId, ct);

        await using (var ins = new NpgsqlCommand("""
                         INSERT INTO waitlist (class_id, student_id, created_at)
                         VALUES (@cid, @sid, clock_timestamp())
                         ON CONFLICT (class_id, student_id) DO NOTHING
                         """, conn))
        {
            ins.Parameters.AddWithValue("cid", classId);
            ins.Parameters.AddWithValue("sid", studentId);
            await ins.ExecuteNonQueryAsync(ct);
        }

        await using var posCmd = new NpgsqlCommand("""
            SELECT w.id, w.created_at, COALESCE(sp.full_name_en, ''),
                   (SELECT COUNT(*) FROM waitlist w2 WHERE w2.class_id = w.class_id AND w2.id <= w.id) AS pos
            FROM waitlist w
            LEFT JOIN student_profiles sp ON sp.student_id = w.student_id
            WHERE w.class_id = @cid AND w.student_id = @sid
            """, conn);
        posCmd.Parameters.AddWithValue("cid", classId);
        posCmd.Parameters.AddWithValue("sid", studentId);
        await using var r = await posCmd.ExecuteReaderAsync(ct);
        await r.ReadAsync(ct);

        var entry = new WaitlistEntryDto(
            r.GetInt64(0),
            Ids.Class(classId),
            className,
            studentId,
            r.GetString(2),
            (int)r.GetInt64(3),
            Iso.Format(r.GetDateTime(1)));

        await AddNotificationAsync(conn, null, "PARENT", studentId, "WAITLIST", "INFO", "Joined Waitlist",
            $"You joined the waitlist for {className} at queue position #{entry.Position}.", "Admission Office", ct);
        await AddNotificationAsync(conn, null, "ALL_ADMINS", null, "WAITLIST", "INFO", "New Waitlist Entry",
            $"Student {studentId} joined waitlist for {className} (Position #{entry.Position}).", $"Parent ({studentId})", ct);

        return entry;
    }

    public async Task<IReadOnlyList<WaitlistEntryDto>> ListStudentWaitlistAsync(string studentId, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            SELECT w.id, w.class_id, c.name, w.student_id, COALESCE(sp.full_name_en, ''),
                   (SELECT COUNT(*) FROM waitlist w2 WHERE w2.class_id = w.class_id AND w2.id <= w.id) AS pos,
                   w.created_at
            FROM waitlist w
            JOIN classes c ON c.id = w.class_id
            LEFT JOIN student_profiles sp ON sp.student_id = w.student_id
            WHERE w.student_id = @sid
            ORDER BY w.id DESC
            """);
        cmd.Parameters.AddWithValue("sid", studentId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<WaitlistEntryDto>();
        while (await r.ReadAsync(ct))
        {
            list.Add(new WaitlistEntryDto(
                r.GetInt64(0),
                Ids.Class(r.GetInt64(1)),
                r.GetString(2),
                r.GetString(3).Trim(),
                r.GetString(4),
                (int)r.GetInt64(5),
                Iso.Format(r.GetDateTime(6))));
        }
        return list;
    }

    // Admin console operations

    public async Task<AdminDashboardDto> GetDashboardAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var classes = await ListAdminClassesInternalAsync(conn, ct);
        var schoolSettings = await GetSchoolSettingsInternalAsync(conn, ct);

        int totalApps = 0, pendingReviews = 0, pendingConcessions = 0, totalWaitlisted = 0;
        decimal totalRevenue = 0m, totalRefunded = 0m;

        await using (var statsCmd = new NpgsqlCommand("""
                         SELECT
                             (SELECT COUNT(*) FROM holds),
                             (SELECT COUNT(*) FROM student_profiles WHERE application_status IN ('SUBMITTED', 'UNDER_REVIEW')),
                             (SELECT COUNT(*) FROM student_profiles WHERE concession_requested = TRUE AND concession_status = 'PENDING'),
                             (SELECT COUNT(*) FROM waitlist),
                             (SELECT COALESCE(SUM(net_amount - refunded_amount), 0) FROM payments),
                             (SELECT COALESCE(SUM(refunded_amount), 0) FROM payments)
                         """, conn))
        await using (var r = await statsCmd.ExecuteReaderAsync(ct))
        {
            if (await r.ReadAsync(ct))
            {
                totalApps = (int)r.GetInt64(0);
                pendingReviews = (int)r.GetInt64(1);
                pendingConcessions = (int)r.GetInt64(2);
                totalWaitlisted = (int)r.GetInt64(3);
                totalRevenue = r.GetDecimal(4);
                totalRefunded = r.GetDecimal(5);
            }
        }

        return new AdminDashboardDto(
            classes,
            classes.Sum(c => c.TotalSeats),
            classes.Sum(c => c.HeldSeats),
            classes.Sum(c => c.ConfirmedSeats),
            classes.Sum(c => c.AvailableSeats),
            totalApps,
            pendingReviews,
            pendingConcessions,
            totalWaitlisted,
            totalRevenue,
            totalRefunded,
            schoolSettings);
    }

    public async Task<AdminClassDetailDto> CreateAdminClassAsync(
        AdminSessionResponse admin, UpsertAdminClassRequest req, CancellationToken ct)
    {
        var name = (req.Name ?? string.Empty).Trim();
        if (name.Length == 0 || name.Length > ClassService.MaxNameLength)
            throw ApiException.Validation("Class name is required and must be at most 200 characters.");
        if (req.TotalSeats <= 0 || req.TotalSeats > ClassService.MaxSeats)
            throw ApiException.Validation("Total seats must be a positive integer.");

        var shift = string.IsNullOrWhiteSpace(req.Shift) ? "Morning" : req.Shift.Trim();
        var year = string.IsNullOrWhiteSpace(req.AcademicYear) ? "2027" : req.AcademicYear.Trim();
        var status = NormalizeClassStatus(req.Status);

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        long id;
        await using (var cmd = new NpgsqlCommand("""
                         INSERT INTO classes (
                             name, shift, academic_year, total_seats, min_age, max_age, status,
                             admission_fee, session_charge, development_fee, security_deposit,
                             first_month_tuition, monthly_tuition, exam_fee, lab_fee
                         )
                         VALUES (
                             @name, @shift, @year, @seats, @min_age, @max_age, @status,
                             @adm, @sess, @dev, @sec, @first_m, @monthly, @exam, @lab
                         )
                         RETURNING id
                         """, conn))
        {
            cmd.Parameters.AddWithValue("name", name);
            cmd.Parameters.AddWithValue("shift", shift);
            cmd.Parameters.AddWithValue("year", year);
            cmd.Parameters.AddWithValue("seats", req.TotalSeats);
            cmd.Parameters.AddWithValue("min_age", (object?)req.MinAge ?? DBNull.Value);
            cmd.Parameters.AddWithValue("max_age", (object?)req.MaxAge ?? DBNull.Value);
            cmd.Parameters.AddWithValue("status", status);
            cmd.Parameters.AddWithValue("adm", req.AdmissionFee ?? 15000m);
            cmd.Parameters.AddWithValue("sess", req.SessionCharge ?? 8000m);
            cmd.Parameters.AddWithValue("dev", req.DevelopmentFee ?? 10000m);
            cmd.Parameters.AddWithValue("sec", req.SecurityDeposit ?? 5000m);
            cmd.Parameters.AddWithValue("first_m", req.FirstMonthTuition ?? 6000m);
            cmd.Parameters.AddWithValue("monthly", req.MonthlyTuition ?? 6000m);
            cmd.Parameters.AddWithValue("exam", req.ExamFee ?? 1500m);
            cmd.Parameters.AddWithValue("lab", req.LabFee ?? 500m);
            id = (long)(await cmd.ExecuteScalarAsync(ct))!;
        }

        await WriteAuditAsync(conn, null, admin.Username, admin.Role, "CREATE_CLASS", "classes", Ids.Class(id),
            $"Created class '{name}' ({shift}) with {req.TotalSeats} seats [{status}].", ct);

        await AddNotificationAsync(conn, null, "ALL", null, "SYSTEM", "INFO", "New Admission Shift Opened",
            $"Class '{name}' ({shift}) opened for admission with {req.TotalSeats} seats.", admin.FullName, ct);

        var classes = await ListAdminClassesInternalAsync(conn, ct);
        return classes.First(c => c.Id == Ids.Class(id));
    }

    public async Task<AdminClassDetailDto> UpdateAdminClassAsync(
        AdminSessionResponse admin, string rawClassId, UpsertAdminClassRequest req, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        var name = (req.Name ?? string.Empty).Trim();
        if (name.Length == 0 || name.Length > ClassService.MaxNameLength)
            throw ApiException.Validation("Class name is required.");
        if (req.TotalSeats <= 0 || req.TotalSeats > ClassService.MaxSeats)
            throw ApiException.Validation("Total seats must be a positive integer.");

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await using (var lockCmd = new NpgsqlCommand("SELECT id FROM classes WHERE id = @id FOR UPDATE", conn, tx))
        {
            lockCmd.Parameters.AddWithValue("id", classId);
            if (await lockCmd.ExecuteScalarAsync(ct) is null)
                throw ApiException.NotFound("Class not found.");
        }

        long taken;
        await using (var cntCmd = new NpgsqlCommand("""
                         SELECT COUNT(*) FROM holds
                         WHERE class_id = @id
                           AND ((status = 'HELD' AND expires_at > clock_timestamp()) OR status = 'CONFIRMED')
                         """, conn, tx))
        {
            cntCmd.Parameters.AddWithValue("id", classId);
            taken = (long)(await cntCmd.ExecuteScalarAsync(ct))!;
        }

        if (req.TotalSeats < taken)
            throw ApiException.Conflict(ErrorCodes.SeatReductionConflict,
                $"Cannot reduce total seats to {req.TotalSeats} because {taken} seats are already held or confirmed.");

        var shift = string.IsNullOrWhiteSpace(req.Shift) ? "Morning" : req.Shift.Trim();
        var year = string.IsNullOrWhiteSpace(req.AcademicYear) ? "2027" : req.AcademicYear.Trim();
        var status = NormalizeClassStatus(req.Status);

        await using (var upd = new NpgsqlCommand("""
                         UPDATE classes SET
                             name                = @name,
                             shift               = @shift,
                             academic_year       = @year,
                             total_seats         = @seats,
                             min_age             = @min_age,
                             max_age             = @max_age,
                             status              = @status,
                             admission_fee       = COALESCE(@adm, admission_fee),
                             session_charge      = COALESCE(@sess, session_charge),
                             development_fee     = COALESCE(@dev, development_fee),
                             security_deposit    = COALESCE(@sec, security_deposit),
                             first_month_tuition = COALESCE(@first_m, first_month_tuition),
                             monthly_tuition     = COALESCE(@monthly, monthly_tuition),
                             exam_fee            = COALESCE(@exam, exam_fee),
                             lab_fee             = COALESCE(@lab, lab_fee)
                         WHERE id = @id
                         """, conn, tx))
        {
            upd.Parameters.AddWithValue("id", classId);
            upd.Parameters.AddWithValue("name", name);
            upd.Parameters.AddWithValue("shift", shift);
            upd.Parameters.AddWithValue("year", year);
            upd.Parameters.AddWithValue("seats", req.TotalSeats);
            upd.Parameters.AddWithValue("min_age", (object?)req.MinAge ?? DBNull.Value);
            upd.Parameters.AddWithValue("max_age", (object?)req.MaxAge ?? DBNull.Value);
            upd.Parameters.AddWithValue("status", status);
            upd.Parameters.Add(new NpgsqlParameter("adm", NpgsqlDbType.Numeric) { Value = (object?)req.AdmissionFee ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("sess", NpgsqlDbType.Numeric) { Value = (object?)req.SessionCharge ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("dev", NpgsqlDbType.Numeric) { Value = (object?)req.DevelopmentFee ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("sec", NpgsqlDbType.Numeric) { Value = (object?)req.SecurityDeposit ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("first_m", NpgsqlDbType.Numeric) { Value = (object?)req.FirstMonthTuition ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("monthly", NpgsqlDbType.Numeric) { Value = (object?)req.MonthlyTuition ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("exam", NpgsqlDbType.Numeric) { Value = (object?)req.ExamFee ?? DBNull.Value });
            upd.Parameters.Add(new NpgsqlParameter("lab", NpgsqlDbType.Numeric) { Value = (object?)req.LabFee ?? DBNull.Value });
            await upd.ExecuteNonQueryAsync(ct);
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "UPDATE_CLASS", "classes", Ids.Class(classId),
            $"Updated class '{name}' ({shift}): seats={req.TotalSeats}, status={status}.", ct);

        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "SYSTEM", "INFO", "Class Updated",
            $"Class '{name}' ({shift}) was updated by {admin.FullName}.", admin.FullName, ct);

        await tx.CommitAsync(ct);

        var classes = await ListAdminClassesInternalAsync(conn, ct);
        return classes.First(c => c.Id == Ids.Class(classId));
    }

    public async Task DeleteAdminClassAsync(AdminSessionResponse admin, string rawClassId, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        string className;
        await using (var lockCmd = new NpgsqlCommand("SELECT name FROM classes WHERE id = @id FOR UPDATE", conn, tx))
        {
            lockCmd.Parameters.AddWithValue("id", classId);
            var res = await lockCmd.ExecuteScalarAsync(ct);
            if (res is null)
                throw ApiException.NotFound("Class not found.");
            className = (string)res;
        }

        long confirmed;
        await using (var cntCmd = new NpgsqlCommand("SELECT COUNT(*) FROM holds WHERE class_id = @id AND status = 'CONFIRMED'", conn, tx))
        {
            cntCmd.Parameters.AddWithValue("id", classId);
            confirmed = (long)(await cntCmd.ExecuteScalarAsync(ct))!;
        }

        if (confirmed > 0)
        {
            throw ApiException.Conflict("CANNOT_DELETE_ACTIVE_CLASS",
                $"Cannot delete '{className}' because {confirmed} student(s) already have confirmed admissions. Set status to 'CLOSED' instead.");
        }

        await using (var delH = new NpgsqlCommand("DELETE FROM holds WHERE class_id = @id", conn, tx))
        {
            delH.Parameters.AddWithValue("id", classId);
            await delH.ExecuteNonQueryAsync(ct);
        }
        await using (var delW = new NpgsqlCommand("DELETE FROM waitlist WHERE class_id = @id", conn, tx))
        {
            delW.Parameters.AddWithValue("id", classId);
            await delW.ExecuteNonQueryAsync(ct);
        }
        await using (var delC = new NpgsqlCommand("DELETE FROM classes WHERE id = @id", conn, tx))
        {
            delC.Parameters.AddWithValue("id", classId);
            await delC.ExecuteNonQueryAsync(ct);
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "DELETE_CLASS", "classes", Ids.Class(classId),
            $"Deleted class '{className}' ({Ids.Class(classId)}).", ct);

        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "SYSTEM", "WARNING", "Class Deleted",
            $"Class '{className}' was deleted by {admin.FullName}.", admin.FullName, ct);

        await tx.CommitAsync(ct);
    }

    public async Task<SchoolSettingsDto> UpdateSettingsAsync(
        AdminSessionResponse admin, UpdateSchoolSettingsRequest req, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        async Task SetKey(string key, string? val)
        {
            if (val is null) return;
            await using var cmd = new NpgsqlCommand("""
                INSERT INTO school_settings (key, value, updated_at)
                VALUES (@k, @v, clock_timestamp())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = clock_timestamp()
                """, conn, tx);
            cmd.Parameters.AddWithValue("k", key);
            cmd.Parameters.AddWithValue("v", val.Trim());
            await cmd.ExecuteNonQueryAsync(ct);
        }

        await SetKey("academic_year", req.AcademicYear);
        await SetKey("admission_opens_at", req.AdmissionOpensAt);
        await SetKey("admission_closes_at", req.AdmissionClosesAt);
        if (req.PaperworkDeadlineDays.HasValue)
            await SetKey("paperwork_deadline_days", Math.Max(1, req.PaperworkDeadlineDays.Value).ToString(CultureInfo.InvariantCulture));
        if (req.WaitlistEnabled.HasValue)
            await SetKey("waitlist_enabled", req.WaitlistEnabled.Value ? "true" : "false");
        if (req.SiblingDiscountPercent.HasValue)
            await SetKey("sibling_discount_percent", Math.Clamp(req.SiblingDiscountPercent.Value, 0, 100).ToString(CultureInfo.InvariantCulture));

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "UPDATE_SETTINGS", "school_settings", "global",
            "Updated academic window and admission rules.", ct);

        await tx.CommitAsync(ct);
        return await GetSchoolSettingsInternalAsync(conn, ct);
    }

    public async Task<IReadOnlyList<AdminApplicationSummaryDto>> ListAdminApplicationsAsync(
        string? classId, string? holdStatus, string? appStatus, string? search, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            SELECT h.id, h.class_id, c.name, c.shift, h.student_id,
                   COALESCE(sp.full_name_en, ''),
                   COALESCE(sp.full_name_bn, ''),
                   COALESCE(sp.father_name, ''),
                   COALESCE(sp.father_phone, ''),
                   CASE WHEN h.status = 'HELD' AND h.expires_at <= now() THEN 'EXPIRED' ELSE h.status END AS eff_status,
                   h.expires_at,
                   h.confirmed_at,
                   COALESCE(sp.application_status, 'DRAFT'),
                   COALESCE(sp.concession_requested, FALSE),
                   COALESCE(sp.concession_status, 'NONE'),
                   COALESCE(sp.concession_percent, 0),
                   COALESCE(sp.dob, ''),
                   COALESCE(sp.present_address, ''),
                   COALESCE(sp.documents_json::text, '[]'),
                   p.receipt_no,
                   p.net_amount,
                   sp.assigned_section,
                   sp.enrolled_student_no,
                   COALESCE(sp.reviewer_note, ''),
                   h.created_at
            FROM holds h
            JOIN classes c ON c.id = h.class_id
            LEFT JOIN student_profiles sp ON sp.student_id = h.student_id
            LEFT JOIN payments p ON p.hold_id = h.id
            ORDER BY h.created_at DESC, h.id DESC
            """, conn);

        var items = new List<AdminApplicationSummaryDto>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            var holdIdStr = Ids.Hold(r.GetInt64(0));
            var cIdStr = Ids.Class(r.GetInt64(1));
            var cName = r.GetString(2);
            var shift = r.GetString(3);
            var sid = r.GetString(4).Trim();
            var nameEn = r.GetString(5);
            var nameBn = r.GetString(6);
            var fatherName = r.GetString(7);
            var fatherPhone = r.GetString(8);
            var effHoldStatus = r.GetString(9);
            var expiresAt = Iso.Format(r.GetDateTime(10));
            var confirmedAt = r.IsDBNull(11) ? null : Iso.Format(r.GetDateTime(11));
            var applicationStatus = r.GetString(12);
            var concReq = r.GetBoolean(13);
            var concStatus = r.GetString(14);
            var concPct = r.GetInt32(15);
            var dob = r.GetString(16);
            var address = r.GetString(17);
            var docsJson = r.GetString(18);
            var receiptNo = r.IsDBNull(19) ? null : r.GetString(19);
            var netPaid = r.IsDBNull(20) ? (decimal?)null : r.GetDecimal(20);
            var section = r.IsDBNull(21) ? null : r.GetString(21);
            var enrolledNo = r.IsDBNull(22) ? null : r.GetString(22);
            var reviewerNote = r.GetString(23);
            var createdAt = Iso.Format(r.GetDateTime(24));

            if (!string.IsNullOrWhiteSpace(classId) && !string.Equals(cIdStr, classId.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;
            if (!string.IsNullOrWhiteSpace(holdStatus) && !string.Equals(effHoldStatus, holdStatus.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;
            if (!string.IsNullOrWhiteSpace(appStatus) && !string.Equals(applicationStatus, appStatus.Trim(), StringComparison.OrdinalIgnoreCase))
                continue;
            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                if (!sid.Contains(q, StringComparison.OrdinalIgnoreCase) &&
                    !nameEn.Contains(q, StringComparison.OrdinalIgnoreCase) &&
                    !nameBn.Contains(q, StringComparison.OrdinalIgnoreCase) &&
                    !fatherName.Contains(q, StringComparison.OrdinalIgnoreCase) &&
                    !holdIdStr.Contains(q, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
            }

            var docs = ParseDocuments(docsJson);
            var completeness = ComputeCompleteness(nameEn, dob, address, fatherName, fatherPhone, docs);

            items.Add(new AdminApplicationSummaryDto(
                holdIdStr, cIdStr, cName, shift, sid, nameEn, nameBn, fatherName, fatherPhone,
                effHoldStatus, expiresAt, confirmedAt, applicationStatus,
                concReq, concStatus, concPct, completeness,
                receiptNo, netPaid, section, enrolledNo, reviewerNote, createdAt));
        }

        return items;
    }

    public async Task<AdminApplicationDetailDto> GetAdminApplicationDetailAsync(string studentId, CancellationToken ct)
    {
        if (!StudentIds.IsValid(studentId))
            throw ApiException.Validation("Student ID must be 17 digits.");

        var profile = await GetStudentProfileAsync(studentId, ct);
        var holds = await holdService.ListForStudentAsync(studentId, ct);
        var payments = await ListStudentPaymentsAsync(studentId, ct);
        return new AdminApplicationDetailDto(profile, holds, payments);
    }

    public async Task<AdminApplicationDetailDto> ReviewApplicationAsync(
        AdminSessionResponse admin, string studentId, AdminReviewDecisionRequest req, CancellationToken ct)
    {
        if (!StudentIds.IsValid(studentId))
            throw ApiException.Validation("Student ID must be 17 digits.");

        var action = (req.Action ?? string.Empty).Trim().ToUpperInvariant();
        var nextStatus = action switch
        {
            "UNDER_REVIEW"       => "UNDER_REVIEW",
            "APPROVE"            => "APPROVED",
            "REQUEST_CORRECTION" => "NEEDS_CORRECTION",
            "REJECT"             => "REJECTED",
            "ENROLL"             => "ENROLLED",
            _ => throw ApiException.Validation("Action must be one of UNDER_REVIEW, APPROVE, REQUEST_CORRECTION, REJECT, ENROLL.")
        };

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await EnsureProfileRowAsync(conn, tx, studentId, ct);
        var existing = await ReadProfileAsync(conn, tx, studentId, ct);

        var section = !string.IsNullOrWhiteSpace(req.AssignedSection)
            ? req.AssignedSection.Trim()
            : (nextStatus == "ENROLLED" && string.IsNullOrWhiteSpace(existing.AssignedSection) ? "Section A" : existing.AssignedSection);

        var studentNo = !string.IsNullOrWhiteSpace(req.EnrolledStudentNo)
            ? req.EnrolledStudentNo.Trim()
            : (nextStatus == "ENROLLED" && string.IsNullOrWhiteSpace(existing.EnrolledStudentNo)
                ? $"STU-2027-{studentId[^4..]}"
                : existing.EnrolledStudentNo);

        await using (var cmd = new NpgsqlCommand("""
                         UPDATE student_profiles SET
                             application_status  = @st,
                             reviewer_note       = @note,
                             assigned_section    = @sec,
                             enrolled_student_no = @sno,
                             updated_at          = clock_timestamp()
                         WHERE student_id = @sid
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("sid", studentId);
            cmd.Parameters.AddWithValue("st", nextStatus);
            cmd.Parameters.AddWithValue("note", (req.Note ?? existing.ReviewerNote).Trim());
            cmd.Parameters.AddWithValue("sec", section);
            cmd.Parameters.AddWithValue("sno", studentNo);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        // Phase F rule: if REJECTED, release seat and process full refund automatically.
        if (nextStatus == "REJECTED")
        {
            await using (var releaseCmd = new NpgsqlCommand("""
                             UPDATE holds SET status = 'CANCELLED', cancelled_at = clock_timestamp()
                             WHERE student_id = @sid AND status IN ('HELD', 'CONFIRMED')
                             """, conn, tx))
            {
                releaseCmd.Parameters.AddWithValue("sid", studentId);
                await releaseCmd.ExecuteNonQueryAsync(ct);
            }

            await using (var refundCmd = new NpgsqlCommand("""
                             UPDATE payments SET
                                 status = 'REFUNDED',
                                 refunded_amount = net_amount,
                                 refund_reason = @reason
                             WHERE student_id = @sid AND status = 'SUCCESS'
                             """, conn, tx))
            {
                refundCmd.Parameters.AddWithValue("sid", studentId);
                refundCmd.Parameters.AddWithValue("reason",
                    string.IsNullOrWhiteSpace(req.Note) ? "Full refund on application rejection" : req.Note.Trim());
                await refundCmd.ExecuteNonQueryAsync(ct);
            }
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, $"APPLICATION_{action}", "student_profiles", studentId,
            $"Set application status to {nextStatus}. Note: {req.Note}", ct);

        if (nextStatus == "APPROVED")
        {
            await AddNotificationAsync(conn, tx, "PARENT", studentId, "REVIEW", "SUCCESS", "Admission Approve",
                $"Congratulations! Admission has been approved. Assigned Section: {section ?? "Section A"}, Roll: {studentNo ?? "1"}.", admin.FullName, ct);
            await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "REVIEW", "SUCCESS", "Admission Approved",
                $"Student {studentId} approved by {admin.FullName}. Section: {section}, Roll: {studentNo}.", admin.FullName, ct);
        }
        else if (nextStatus == "CORRECTIONS_REQUESTED")
        {
            await AddNotificationAsync(conn, tx, "PARENT", studentId, "REVIEW", "WARNING", "Corrections Requested",
                $"The admission office requested updates: {req.Note}.", admin.FullName, ct);
            await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "REVIEW", "WARNING", "Corrections Requested",
                $"Officer requested updates for student {studentId}: {req.Note}.", admin.FullName, ct);
        }
        else if (nextStatus == "REJECTED")
        {
            await AddNotificationAsync(conn, tx, "PARENT", studentId, "REVIEW", "DANGER", "Application Decision Update",
                $"Application review concluded: Not Admitted ({req.Note}). Full fee refund has been queued.", admin.FullName, ct);
            await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "REVIEW", "DANGER", "Application Rejected",
                $"Student {studentId} rejected by {admin.FullName}. Seat released and refund queued.", admin.FullName, ct);
        }

        await tx.CommitAsync(ct);
        return await GetAdminApplicationDetailAsync(studentId, ct);
    }

    public async Task DeleteStudentApplicationAsync(AdminSessionResponse admin, string studentId, CancellationToken ct)
    {
        StudentIds.ValidateOr400(studentId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await using (var delDocs = new NpgsqlCommand("DELETE FROM student_documents WHERE student_id = @sid", conn, tx))
        {
            delDocs.Parameters.AddWithValue("sid", studentId);
            await delDocs.ExecuteNonQueryAsync(ct);
        }
        await using (var delWait = new NpgsqlCommand("DELETE FROM waitlist WHERE student_id = @sid", conn, tx))
        {
            delWait.Parameters.AddWithValue("sid", studentId);
            await delWait.ExecuteNonQueryAsync(ct);
        }
        await using (var delHolds = new NpgsqlCommand("DELETE FROM holds WHERE student_id = @sid", conn, tx))
        {
            delHolds.Parameters.AddWithValue("sid", studentId);
            await delHolds.ExecuteNonQueryAsync(ct);
        }
        await using (var delProf = new NpgsqlCommand("DELETE FROM student_profiles WHERE student_id = @sid", conn, tx))
        {
            delProf.Parameters.AddWithValue("sid", studentId);
            await delProf.ExecuteNonQueryAsync(ct);
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "DELETE_APPLICATION", "student_profiles", studentId,
            $"Deleted application and student profile for {studentId}.", ct);

        await tx.CommitAsync(ct);
    }

    public async Task<StudentProfileDto> VerifyDocumentAsync(
        AdminSessionResponse admin, string studentId, AdminVerifyDocumentRequest req, CancellationToken ct)
    {
        if (!StudentIds.IsValid(studentId))
            throw ApiException.Validation("Student ID must be 17 digits.");

        var type = (req.Type ?? string.Empty).Trim().ToUpperInvariant();
        var status = (req.Status ?? string.Empty).Trim().ToUpperInvariant();
        if (status is not ("APPROVED" or "CORRECTION_NEEDED" or "PENDING"))
            throw ApiException.Validation("Document status must be APPROVED, CORRECTION_NEEDED, or PENDING.");

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await EnsureProfileRowAsync(conn, tx, studentId, ct);
        var profile = await ReadProfileAsync(conn, tx, studentId, ct);

        var updatedDocs = profile.Documents
            .Select(d => d.Type == type
                ? d with { Status = status, ReviewerComment = (req.Comment ?? string.Empty).Trim() }
                : d)
            .ToList();

        await SaveDocumentsJsonAsync(conn, tx, studentId, updatedDocs, ct);
        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "VERIFY_DOCUMENT", "student_profiles", studentId,
            $"Document {type} marked as {status}. Comment: {req.Comment}", ct);

        var updated = await ReadProfileAsync(conn, tx, studentId, ct);

        if (status == "APPROVED")
        {
            await AddNotificationAsync(conn, tx, "PARENT", studentId, "DOCUMENT", "SUCCESS", $"Document Approved: {type}",
                $"Your {type} document was verified and approved by the Admission Officer.", admin.FullName, ct);
            await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "DOCUMENT", "INFO", "Document Verified",
                $"Officer approved {type} for student {studentId}.", admin.FullName, ct);
        }
        else if (status == "CORRECTION_NEEDED")
        {
            await AddNotificationAsync(conn, tx, "PARENT", studentId, "DOCUMENT", "DANGER", $"Action Required: {type}",
                $"The Admission Officer requested correction on {type}: {req.Comment}.", admin.FullName, ct);
            await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "DOCUMENT", "WARNING", "Document Correction Requested",
                $"Officer requested correction on {type} for student {studentId}: {req.Comment}.", admin.FullName, ct);
        }

        await tx.CommitAsync(ct);
        return updated;
    }

    public async Task<StudentProfileDto> ReviewConcessionAsync(
        AdminSessionResponse admin, string studentId, AdminConcessionDecisionRequest req, CancellationToken ct)
    {
        if (!StudentIds.IsValid(studentId))
            throw ApiException.Validation("Student ID must be 17 digits.");

        var status = (req.Status ?? string.Empty).Trim().ToUpperInvariant();
        if (status is not ("APPROVED" or "DECLINED" or "PENDING"))
            throw ApiException.Validation("Concession status must be APPROVED, DECLINED, or PENDING.");

        var pct = status == "APPROVED" ? Math.Clamp(req.Percent, 5, 100) : 0;

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        await EnsureProfileRowAsync(conn, tx, studentId, ct);
        await using (var cmd = new NpgsqlCommand("""
                         UPDATE student_profiles SET
                             concession_status  = @st,
                             concession_percent = @pct,
                             concession_note    = @note,
                             updated_at         = clock_timestamp()
                         WHERE student_id = @sid
                         """, conn, tx))
        {
            cmd.Parameters.AddWithValue("sid", studentId);
            cmd.Parameters.AddWithValue("st", status);
            cmd.Parameters.AddWithValue("pct", pct);
            cmd.Parameters.AddWithValue("note", (req.Note ?? string.Empty).Trim());
            await cmd.ExecuteNonQueryAsync(ct);
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "REVIEW_CONCESSION", "student_profiles", studentId,
            $"Need-based concession {status} ({pct}% off future monthly tuition). Note: {req.Note}", ct);

        var updated = await ReadProfileAsync(conn, tx, studentId, ct);

        await AddNotificationAsync(conn, tx, "PARENT", studentId, "REFUND", status == "APPROVED" ? "SUCCESS" : "INFO",
            $"Concession Request {status}",
            $"Your need-based concession application has been {status.ToLowerInvariant()} ({pct}% discount).", admin.FullName, ct);
        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "REFUND", "INFO", "Concession Reviewed",
            $"Concession {status} for student {studentId} ({pct}%).", admin.FullName, ct);

        await tx.CommitAsync(ct);
        return updated;
    }

    public async Task<IReadOnlyList<PaymentRecordDto>> ListAdminPaymentsAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            SELECT p.id, p.hold_id, p.class_id, c.name, p.student_id,
                   COALESCE(sp.full_name_en, ''),
                   p.receipt_no, p.gross_amount, p.discount_amount, p.discount_reason,
                   p.net_amount, p.gateway, p.status, p.refunded_amount, p.refund_reason, p.paid_at
            FROM payments p
            JOIN classes c ON c.id = p.class_id
            LEFT JOIN student_profiles sp ON sp.student_id = p.student_id
            ORDER BY p.paid_at DESC, p.id DESC
            """);
        return await ReadPaymentsAsync(cmd, ct);
    }

    public async Task<PaymentRecordDto> RefundPaymentAsync(
        AdminSessionResponse admin, long paymentId, AdminRefundRequest req, CancellationToken ct)
    {
        if (req.Amount <= 0)
            throw ApiException.Validation("Refund amount must be positive.");

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        decimal netAmount;
        string receiptNo;
        string studentId;
        await using (var getCmd = new NpgsqlCommand(
                         "SELECT net_amount, receipt_no, student_id FROM payments WHERE id = @id FOR UPDATE", conn, tx))
        {
            getCmd.Parameters.AddWithValue("id", paymentId);
            await using var r = await getCmd.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Payment record not found.");
            netAmount = r.GetDecimal(0);
            receiptNo = r.GetString(1);
            studentId = r.GetString(2).Trim();
        }

        var refundAmt = Math.Min(netAmount, req.Amount);
        var status = refundAmt >= netAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";
        var reason = string.IsNullOrWhiteSpace(req.Reason) ? "Admin refund" : req.Reason.Trim();

        await using (var upd = new NpgsqlCommand("""
                         UPDATE payments SET
                             status = @st,
                             refunded_amount = @amt,
                             refund_reason = @reason
                         WHERE id = @id
                         """, conn, tx))
        {
            upd.Parameters.AddWithValue("id", paymentId);
            upd.Parameters.AddWithValue("st", status);
            upd.Parameters.AddWithValue("amt", refundAmt);
            upd.Parameters.AddWithValue("reason", reason);
            await upd.ExecuteNonQueryAsync(ct);
        }

        await WriteAuditAsync(conn, tx, admin.Username, admin.Role, "ISSUE_REFUND", "payments", receiptNo,
            $"Refunded {refundAmt} BDT ({status}). Reason: {reason}", ct);

        await AddNotificationAsync(conn, tx, "PARENT", studentId, "REFUND", "INFO", "Refund Processed",
            $"A refund of BDT {refundAmt:N0} has been processed for receipt {receiptNo}. Reason: {reason}.", admin.FullName, ct);
        await AddNotificationAsync(conn, tx, "ALL_ADMINS", null, "REFUND", "WARNING", "Refund Issued",
            $"Accountant {admin.FullName} issued BDT {refundAmt:N0} refund for receipt {receiptNo}.", admin.FullName, ct);

        await tx.CommitAsync(ct);

        var all = await ListAdminPaymentsAsync(ct);
        return all.First(p => p.Id == paymentId);
    }

    public async Task<IReadOnlyList<WaitlistEntryDto>> ListAdminWaitlistAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            SELECT w.id, w.class_id, c.name, w.student_id, COALESCE(sp.full_name_en, ''),
                   (SELECT COUNT(*) FROM waitlist w2 WHERE w2.class_id = w.class_id AND w2.id <= w.id) AS pos,
                   w.created_at
            FROM waitlist w
            JOIN classes c ON c.id = w.class_id
            LEFT JOIN student_profiles sp ON sp.student_id = w.student_id
            ORDER BY w.class_id, w.id
            """);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<WaitlistEntryDto>();
        while (await r.ReadAsync(ct))
        {
            list.Add(new WaitlistEntryDto(
                r.GetInt64(0),
                Ids.Class(r.GetInt64(1)),
                r.GetString(2),
                r.GetString(3).Trim(),
                r.GetString(4),
                (int)r.GetInt64(5),
                Iso.Format(r.GetDateTime(6))));
        }
        return list;
    }

    public async Task<IReadOnlyList<AuditLogDto>> ListAuditLogsAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            SELECT id, actor, role, action, entity, entity_id, details, created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 200
            """);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<AuditLogDto>();
        while (await r.ReadAsync(ct))
        {
            list.Add(new AuditLogDto(
                r.GetInt64(0),
                r.GetString(1),
                r.GetString(2),
                r.GetString(3),
                r.GetString(4),
                r.GetString(5),
                r.GetString(6),
                Iso.Format(r.GetDateTime(7))));
        }
        return list;
    }

    // Internal helpers

    private static string NormalizeClassStatus(string? status)
    {
        var s = (status ?? "OPEN").Trim().ToUpperInvariant();
        return s is "DRAFT" or "OPEN" or "CLOSED" ? s : "OPEN";
    }

    private static async Task EnsureProfileRowAsync(
        NpgsqlConnection conn, NpgsqlTransaction? tx, string studentId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(
            "INSERT INTO student_profiles (student_id) VALUES (@sid) ON CONFLICT (student_id) DO NOTHING", conn, tx);
        cmd.Parameters.AddWithValue("sid", studentId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<StudentProfileDto> ReadProfileAsync(
        NpgsqlConnection conn, NpgsqlTransaction? tx, string studentId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT student_id, full_name_en, full_name_bn, dob, gender, nationality, religion, blood_group,
                   present_address, permanent_address, previous_school, last_class_passed, last_result, health_notes,
                   has_sibling, sibling_name, sibling_class, sibling_student_id,
                   father_name, father_nid, father_occupation, father_employer, father_phone, father_email,
                   mother_name, mother_nid, mother_occupation, mother_employer, mother_phone, mother_email,
                   guardian_name, guardian_relation, guardian_phone, emergency_contact,
                   monthly_income, income_bracket, income_source, dependents,
                   concession_requested, concession_status, concession_percent, concession_note,
                   documents_json::text, application_status, reviewer_note, assigned_section, enrolled_student_no, updated_at
            FROM student_profiles
            WHERE student_id = @sid
            """, conn, tx);
        cmd.Parameters.AddWithValue("sid", studentId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct))
            throw ApiException.NotFound("Student profile not found.");

        var docs = ParseDocuments(r.GetString(42));
        var nameEn = r.GetString(1);
        var dob = r.GetString(3);
        var addr = r.GetString(8);
        var fName = r.GetString(18);
        var fPhone = r.GetString(22);
        var completeness = ComputeCompleteness(nameEn, dob, addr, fName, fPhone, docs);

        return new StudentProfileDto(
            r.GetString(0).Trim(),
            nameEn,
            r.GetString(2),
            dob,
            r.GetString(4),
            r.GetString(5),
            r.GetString(6),
            r.GetString(7),
            addr,
            r.GetString(9),
            r.GetString(10),
            r.GetString(11),
            r.GetString(12),
            r.GetString(13),
            r.GetBoolean(14),
            r.GetString(15),
            r.GetString(16),
            r.GetString(17),
            fName,
            r.GetString(19),
            r.GetString(20),
            r.GetString(21),
            fPhone,
            r.GetString(23),
            r.GetString(24),
            r.GetString(25),
            r.GetString(26),
            r.GetString(27),
            r.GetString(28),
            r.GetString(29),
            r.GetString(30),
            r.GetString(31),
            r.GetString(32),
            r.GetString(33),
            r.GetDecimal(34),
            r.GetString(35),
            r.GetString(36),
            r.GetInt32(37),
            r.GetBoolean(38),
            r.GetString(39),
            r.GetInt32(40),
            r.GetString(41),
            docs,
            r.GetString(43),
            r.GetString(44),
            r.GetString(45),
            r.GetString(46),
            completeness,
            Iso.Format(r.GetDateTime(47)));
    }

    private static IReadOnlyList<DocumentItemDto> ParseDocuments(string rawJson)
    {
        var byType = new Dictionary<string, DocumentItemDto>(StringComparer.OrdinalIgnoreCase);
        try
        {
            var parsed = JsonSerializer.Deserialize<List<DocumentItemDto>>(rawJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (parsed is not null)
            {
                foreach (var item in parsed)
                {
                    if (!string.IsNullOrWhiteSpace(item.Type))
                        byType[item.Type.ToUpperInvariant()] = item;
                }
            }
        }
        catch
        {
            // Ignore malformed JSON and fall back to default slots
        }

        var result = new List<DocumentItemDto>();
        foreach (var (type, label) in DefaultDocumentSlots)
        {
            if (byType.TryGetValue(type, out var existing))
                result.Add(existing with { Type = type, Label = string.IsNullOrWhiteSpace(existing.Label) ? label : existing.Label });
            else
                result.Add(new DocumentItemDto(type, label, "", 0, "", "NOT_UPLOADED", ""));
        }
        return result;
    }

    private static async Task SaveDocumentsJsonAsync(
        NpgsqlConnection conn, NpgsqlTransaction tx, string studentId, IReadOnlyList<DocumentItemDto> docs, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(docs);
        await using var cmd = new NpgsqlCommand("""
            UPDATE student_profiles
            SET documents_json = @j::jsonb, updated_at = clock_timestamp()
            WHERE student_id = @sid
            """, conn, tx);
        cmd.Parameters.AddWithValue("sid", studentId);
        cmd.Parameters.AddWithValue("j", json);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static int ComputeCompleteness(
        string fullNameEn, string dob, string presentAddress, string fatherName, string fatherPhone,
        IReadOnlyList<DocumentItemDto> docs)
    {
        int score = 0;
        if (!string.IsNullOrWhiteSpace(fullNameEn)) score += 20;
        if (!string.IsNullOrWhiteSpace(dob)) score += 15;
        if (!string.IsNullOrWhiteSpace(presentAddress)) score += 15;
        if (!string.IsNullOrWhiteSpace(fatherName)) score += 15;
        if (!string.IsNullOrWhiteSpace(fatherPhone)) score += 15;

        var uploadedCount = docs.Count(d => !string.IsNullOrWhiteSpace(d.FileName) && d.Status != "NOT_UPLOADED");
        score += Math.Min(20, uploadedCount * 5);
        return Math.Clamp(score, 0, 100);
    }

    private static async Task<IReadOnlyList<AdminClassDetailDto>> ListAdminClassesInternalAsync(
        NpgsqlConnection conn, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            SELECT c.id, c.name, c.shift, c.academic_year, c.total_seats,
                   COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()) AS held,
                   COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED')                     AS confirmed,
                   c.min_age, c.max_age, c.status,
                   c.admission_fee, c.session_charge, c.development_fee, c.security_deposit,
                   c.first_month_tuition, c.monthly_tuition, c.exam_fee, c.lab_fee
            FROM classes c
            LEFT JOIN holds h ON h.class_id = c.id AND h.status IN ('HELD', 'CONFIRMED')
            GROUP BY c.id
            ORDER BY c.id
            """, conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<AdminClassDetailDto>();
        while (await r.ReadAsync(ct))
        {
            var total = r.GetInt32(4);
            var held = (int)r.GetInt64(5);
            var confirmed = (int)r.GetInt64(6);
            var adm = r.GetDecimal(10);
            var sess = r.GetDecimal(11);
            var dev = r.GetDecimal(12);
            var sec = r.GetDecimal(13);
            var firstM = r.GetDecimal(14);
            var monthly = r.GetDecimal(15);
            var exam = r.GetDecimal(16);
            var lab = r.GetDecimal(17);

            list.Add(new AdminClassDetailDto(
                Ids.Class(r.GetInt64(0)),
                r.GetString(1),
                r.GetString(2),
                r.GetString(3),
                total,
                held,
                confirmed,
                Math.Max(0, total - held - confirmed),
                r.IsDBNull(7) ? null : r.GetInt32(7),
                r.IsDBNull(8) ? null : r.GetInt32(8),
                r.GetString(9),
                adm, sess, dev, sec, firstM, monthly, exam, lab,
                adm + sess + dev + sec + firstM));
        }
        return list;
    }

    private async Task<SchoolSettingsDto> GetSchoolSettingsInternalAsync(NpgsqlConnection conn, CancellationToken ct)
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        await using (var cmd = new NpgsqlCommand("SELECT key, value FROM school_settings", conn))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            while (await r.ReadAsync(ct)) dict[r.GetString(0)] = r.GetString(1);
        }

        return new SchoolSettingsDto(
            dict.GetValueOrDefault("academic_year", "2027"),
            dict.GetValueOrDefault("admission_opens_at", "2026-01-01T00:00:00Z"),
            dict.GetValueOrDefault("admission_closes_at", "2027-12-31T23:59:59Z"),
            settings.HoldDurationSeconds,
            int.TryParse(dict.GetValueOrDefault("paperwork_deadline_days", "7"), out var d) ? d : 7,
            !string.Equals(dict.GetValueOrDefault("waitlist_enabled", "true"), "false", StringComparison.OrdinalIgnoreCase),
            int.TryParse(dict.GetValueOrDefault("sibling_discount_percent", "10"), out var s) ? s : 10);
    }

    private static async Task<IReadOnlyList<PaymentRecordDto>> ReadPaymentsAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<PaymentRecordDto>();
        while (await r.ReadAsync(ct))
        {
            list.Add(new PaymentRecordDto(
                r.GetInt64(0),
                Ids.Hold(r.GetInt64(1)),
                Ids.Class(r.GetInt64(2)),
                r.GetString(3),
                r.GetString(4).Trim(),
                r.GetString(5),
                r.GetString(6),
                r.GetDecimal(7),
                r.GetDecimal(8),
                r.GetString(9),
                r.GetDecimal(10),
                r.GetString(11),
                r.GetString(12),
                r.GetDecimal(13),
                r.GetString(14),
                Iso.Format(r.GetDateTime(15))));
        }
        return list;
    }

    // Notifications & alert queries

    public async Task<NotificationSummaryDto> ListNotificationsAsync(string? studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var list = new List<NotificationDto>();
        var unreadCount = 0;

        await using (var cmd = new NpgsqlCommand("""
            SELECT id, recipient_type, recipient_id, category, severity, title, message, actor, is_read, created_at
            FROM notifications
            WHERE (recipient_type = 'PARENT' AND recipient_id = @sid)
               OR (recipient_type = 'ALL')
            ORDER BY created_at DESC
            LIMIT 50
            """, conn))
        {
            cmd.Parameters.AddWithValue("sid", (object?)studentId ?? string.Empty);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                var isRead = r.GetBoolean(8);
                if (!isRead) unreadCount++;
                list.Add(new NotificationDto(
                    r.GetInt64(0),
                    r.GetString(1),
                    r.IsDBNull(2) ? null : r.GetString(2),
                    r.GetString(3),
                    r.GetString(4),
                    r.GetString(5),
                    r.GetString(6),
                    r.GetString(7),
                    isRead,
                    Iso.Format(r.GetDateTime(9))));
            }
        }

        return new NotificationSummaryDto(unreadCount, list);
    }

    public async Task MarkNotificationReadAsync(long notifId, string? studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE notifications SET is_read = TRUE
            WHERE id = @id
              AND (recipient_type = 'ALL' OR (recipient_type = 'PARENT' AND recipient_id = @sid) OR @sid = '')
            """, conn);
        cmd.Parameters.AddWithValue("id", notifId);
        cmd.Parameters.AddWithValue("sid", studentId ?? string.Empty);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task MarkAllNotificationsReadAsync(string? studentId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("""
            UPDATE notifications SET is_read = TRUE
            WHERE (recipient_type = 'PARENT' AND recipient_id = @sid) OR (recipient_type = 'ALL')
            """, conn);
        cmd.Parameters.AddWithValue("sid", (object?)studentId ?? string.Empty);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<NotificationSummaryDto> ListAdminNotificationsAsync(string? category, bool unreadOnly, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        var list = new List<NotificationDto>();
        var unreadCount = 0;

        var sql = """
            SELECT id, recipient_type, recipient_id, category, severity, title, message, actor, is_read, created_at
            FROM notifications
            WHERE recipient_type IN ('ALL_ADMINS', 'ALL')
            """;
        if (!string.IsNullOrWhiteSpace(category))
        {
            sql += " AND category = @cat";
        }
        if (unreadOnly)
        {
            sql += " AND is_read = FALSE";
        }
        sql += " ORDER BY created_at DESC LIMIT 100";

        await using (var cmd = new NpgsqlCommand(sql, conn))
        {
            if (!string.IsNullOrWhiteSpace(category))
            {
                cmd.Parameters.AddWithValue("cat", category.Trim().ToUpperInvariant());
            }
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                var isRead = r.GetBoolean(8);
                if (!isRead) unreadCount++;
                list.Add(new NotificationDto(
                    r.GetInt64(0),
                    r.GetString(1),
                    r.IsDBNull(2) ? null : r.GetString(2),
                    r.GetString(3),
                    r.GetString(4),
                    r.GetString(5),
                    r.GetString(6),
                    r.GetString(7),
                    isRead,
                    Iso.Format(r.GetDateTime(9))));
            }
        }

        return new NotificationSummaryDto(unreadCount, list);
    }

    public async Task MarkAdminNotificationReadAsync(long notifId, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("UPDATE notifications SET is_read = TRUE WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", notifId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task MarkAllAdminNotificationsReadAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand(
            "UPDATE notifications SET is_read = TRUE WHERE recipient_type IN ('ALL_ADMINS', 'ALL')", conn);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<NotificationDto> BroadcastNotificationAsync(
        AdminSessionResponse admin, BroadcastNotificationRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Message))
            throw ApiException.Validation("Title and message are required.");

        var recipientType = string.IsNullOrWhiteSpace(req.RecipientType) ? "ALL" : req.RecipientType.Trim().ToUpperInvariant();
        var category = string.IsNullOrWhiteSpace(req.Category) ? "SYSTEM" : req.Category.Trim().ToUpperInvariant();
        var severity = string.IsNullOrWhiteSpace(req.Severity) ? "INFO" : req.Severity.Trim().ToUpperInvariant();

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        long id;
        DateTime createdAt;
        await using (var cmd = new NpgsqlCommand("""
            INSERT INTO notifications (recipient_type, recipient_id, category, severity, title, message, actor, created_at)
            VALUES (@rt, @rid, @cat, @sev, @title, @msg, @actor, clock_timestamp())
            RETURNING id, created_at
            """, conn))
        {
            cmd.Parameters.AddWithValue("rt", recipientType);
            cmd.Parameters.AddWithValue("rid", (object?)req.RecipientId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("cat", category);
            cmd.Parameters.AddWithValue("sev", severity);
            cmd.Parameters.AddWithValue("title", req.Title.Trim());
            cmd.Parameters.AddWithValue("msg", req.Message.Trim());
            cmd.Parameters.AddWithValue("actor", admin.FullName + " (" + admin.Role + ")");
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            id = r.GetInt64(0);
            createdAt = r.GetDateTime(1);
        }

        await WriteAuditAsync(conn, null, admin.Username, admin.Role, "BROADCAST_ALERT", "notifications", id.ToString(),
            $"{severity}: {req.Title}", ct);

        return new NotificationDto(id, recipientType, req.RecipientId, category, severity, req.Title.Trim(), req.Message.Trim(),
            admin.FullName, false, Iso.Format(createdAt));
    }

    public async Task DeleteAdminNotificationAsync(long id, CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand("DELETE FROM notifications WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public static async Task AddNotificationAsync(
        NpgsqlConnection conn, NpgsqlTransaction? tx,
        string recipientType, string? recipientId, string category, string severity,
        string title, string message, string actor, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO notifications (recipient_type, recipient_id, category, severity, title, message, actor, created_at)
            VALUES (@rt, @rid, @cat, @sev, @title, @msg, @actor, clock_timestamp())
            """, conn, tx);
        cmd.Parameters.AddWithValue("rt", recipientType);
        cmd.Parameters.AddWithValue("rid", (object?)recipientId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cat", category);
        cmd.Parameters.AddWithValue("sev", severity);
        cmd.Parameters.AddWithValue("title", title);
        cmd.Parameters.AddWithValue("msg", message);
        cmd.Parameters.AddWithValue("actor", actor);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task WriteAuditAsync(
        NpgsqlConnection conn, NpgsqlTransaction? tx,
        string actor, string role, string action, string entity, string entityId, string details,
        CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO audit_logs (actor, role, action, entity, entity_id, details, created_at)
            VALUES (@a, @r, @act, @ent, @eid, @det, clock_timestamp())
            """, conn, tx);
        cmd.Parameters.AddWithValue("a", actor);
        cmd.Parameters.AddWithValue("r", role);
        cmd.Parameters.AddWithValue("act", action);
        cmd.Parameters.AddWithValue("ent", entity);
        cmd.Parameters.AddWithValue("eid", entityId);
        cmd.Parameters.AddWithValue("det", details);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

