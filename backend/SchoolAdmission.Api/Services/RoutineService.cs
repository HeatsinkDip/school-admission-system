using System.Globalization;
using System.Text.Json;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Weekly class routine (timetable) per class-shift. Each class-shift has fixed school hours
/// (e.g. Morning 07:30-12:30, Day 12:45-17:45) and a list of periods per weekday. If the admin
/// has not saved a custom routine yet, a sensible default is generated from the shift.
/// </summary>
public sealed class RoutineService(NpgsqlDataSource dataSource)
{
    public static readonly string[] AllDays = ["SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI"];
    private static readonly string[] DefaultDays = ["SUN", "MON", "TUE", "WED", "THU"];

    private static readonly string[] Subjects =
    [
        "Bangla", "English", "Mathematics", "General Science", "ICT",
        "Bangladesh & Global Studies", "Religion & Moral Education", "Physical Education", "Arts & Crafts",
    ];

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const string SelectSql = """
        SELECT id, name, shift, start_time, end_time, class_days, routine_json::text
        FROM classes
        """;

    public async Task<IReadOnlyList<ClassRoutineDto>> ListAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = new NpgsqlCommand(SelectSql + " ORDER BY id", conn);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var list = new List<ClassRoutineDto>();
        while (await r.ReadAsync(ct)) list.Add(Read(r));
        return list;
    }

    public async Task<ClassRoutineDto> GetAsync(string rawClassId, CancellationToken ct)
    {
        var classId = Ids.ParseClassOr404(rawClassId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        return await GetInternalAsync(conn, classId, ct);
    }

    public async Task<ClassRoutineDto> SaveAsync(AdminSessionResponse admin, string rawClassId, SaveClassRoutineRequest req, CancellationToken ct)
    {
        if (admin.Role == "ACCOUNTANT")
            throw ApiException.Forbidden("Only the Super Admin or an Admission Officer can edit class routines.");

        var classId = Ids.ParseClassOr404(rawClassId);
        if (req is null) throw ApiException.Validation("Request body is required.");

        var start = NormalizeTime(req.StartTime, "startTime");
        var end = NormalizeTime(req.EndTime, "endTime");
        if (string.CompareOrdinal(start, end) >= 0)
            throw ApiException.Validation("startTime must be earlier than endTime.");

        var days = (req.Days ?? DefaultDays)
            .Select(d => (d ?? "").Trim().ToUpperInvariant())
            .Where(d => d.Length > 0)
            .Distinct()
            .ToList();
        if (days.Count == 0) throw ApiException.Validation("At least one school day is required.");
        foreach (var d in days)
            if (!AllDays.Contains(d)) throw ApiException.Validation($"Unknown day '{d}'. Use SAT, SUN, MON, TUE, WED, THU or FRI.");

        var periods = new List<RoutinePeriodDto>();
        foreach (var p in req.Periods ?? [])
        {
            var day = (p.Day ?? "").Trim().ToUpperInvariant();
            if (!days.Contains(day)) throw ApiException.Validation($"Period day '{p.Day}' is not one of the class days.");
            var ps = NormalizeTime(p.StartTime, "period startTime");
            var pe = NormalizeTime(p.EndTime, "period endTime");
            if (string.CompareOrdinal(ps, pe) >= 0) throw ApiException.Validation($"Period {p.Period} on {day}: start must be before end.");
            if (string.CompareOrdinal(ps, start) < 0 || string.CompareOrdinal(pe, end) > 0)
                throw ApiException.Validation($"Period {p.Period} on {day} ({ps}-{pe}) is outside the class hours {start}-{end}.");
            var subject = (p.Subject ?? "").Trim();
            if (subject.Length == 0) throw ApiException.Validation($"Period {p.Period} on {day}: subject is required.");
            periods.Add(new RoutinePeriodDto(day, p.Period, ps, pe, Trunc(subject, 100), Trunc((p.Teacher ?? "").Trim(), 100), Trunc((p.Room ?? "").Trim(), 50)));
        }

        // No two periods may overlap on the same day.
        foreach (var group in periods.GroupBy(p => p.Day))
        {
            var ordered = group.OrderBy(p => p.StartTime, StringComparer.Ordinal).ToList();
            for (var i = 1; i < ordered.Count; i++)
                if (string.CompareOrdinal(ordered[i].StartTime, ordered[i - 1].EndTime) < 0)
                    throw ApiException.Validation(
                        $"On {group.Key}, '{ordered[i - 1].Subject}' ({ordered[i - 1].StartTime}-{ordered[i - 1].EndTime}) overlaps '{ordered[i].Subject}' ({ordered[i].StartTime}-{ordered[i].EndTime}).");
        }

        var sorted = periods
            .OrderBy(p => Array.IndexOf(AllDays, p.Day))
            .ThenBy(p => p.StartTime, StringComparer.Ordinal)
            .ToList();

        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using (var cmd = new NpgsqlCommand("""
                         UPDATE classes SET start_time = @st, end_time = @et, class_days = @days, routine_json = @json::jsonb
                         WHERE id = @id
                         """, conn))
        {
            cmd.Parameters.AddWithValue("id", classId);
            cmd.Parameters.AddWithValue("st", start);
            cmd.Parameters.AddWithValue("et", end);
            cmd.Parameters.AddWithValue("days", string.Join(',', days));
            cmd.Parameters.AddWithValue("json", JsonSerializer.Serialize(sorted, Json));
            if (await cmd.ExecuteNonQueryAsync(ct) == 0) throw ApiException.NotFound("Class not found.");
        }

        await AuditAsync(conn, admin, "UPDATE_ROUTINE", Ids.Class(classId), $"{start}-{end}, {days.Count} days, {sorted.Count} periods", ct);
        return await GetInternalAsync(conn, classId, ct);
    }

    public async Task<ClassRoutineDto> ResetAsync(AdminSessionResponse admin, string rawClassId, CancellationToken ct)
    {
        if (admin.Role == "ACCOUNTANT")
            throw ApiException.Forbidden("Only the Super Admin or an Admission Officer can edit class routines.");
        var classId = Ids.ParseClassOr404(rawClassId);
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using (var cmd = new NpgsqlCommand("""
                         UPDATE classes SET start_time = NULL, end_time = NULL,
                                class_days = 'SUN,MON,TUE,WED,THU', routine_json = '[]'::jsonb
                         WHERE id = @id
                         """, conn))
        {
            cmd.Parameters.AddWithValue("id", classId);
            if (await cmd.ExecuteNonQueryAsync(ct) == 0) throw ApiException.NotFound("Class not found.");
        }
        await AuditAsync(conn, admin, "RESET_ROUTINE", Ids.Class(classId), "Routine reset to shift default", ct);
        return await GetInternalAsync(conn, classId, ct);
    }

    // ------------------------------------------------------------------ helpers

    private static async Task<ClassRoutineDto> GetInternalAsync(NpgsqlConnection conn, long classId, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(SelectSql + " WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", classId);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) throw ApiException.NotFound("Class not found.");
        return Read(r);
    }

    private static ClassRoutineDto Read(NpgsqlDataReader r)
    {
        var id = r.GetInt64(0);
        var name = r.GetString(1);
        var shift = r.GetString(2);
        var (defStart, defEnd) = DefaultHours(shift, name);
        var start = r.IsDBNull(3) ? defStart : r.GetString(3);
        var end = r.IsDBNull(4) ? defEnd : r.GetString(4);
        var days = r.GetString(5).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        if (days.Count == 0) days = [.. DefaultDays];

        List<RoutinePeriodDto> periods;
        try { periods = JsonSerializer.Deserialize<List<RoutinePeriodDto>>(r.GetString(6), Json) ?? []; }
        catch (JsonException) { periods = []; }

        var isDefault = periods.Count == 0;
        if (isDefault) periods = BuildDefault(id, start, end, days);

        return new ClassRoutineDto(Ids.Class(id), name, shift, start, end, days, periods, isDefault);
    }

    /// <summary>Fixed school hours derived from the shift (or the class name when the shift is generic).</summary>
    public static (string Start, string End) DefaultHours(string shift, string name)
    {
        // The class name wins ("Class 6 - Day Shift"), because POST /classes leaves shift at its default.
        foreach (var s in new[] { name.ToLowerInvariant(), shift.ToLowerInvariant() })
        {
            if (s.Contains("evening")) return ("14:30", "18:30");
            if (s.Contains("day shift") || s.Trim() == "day") return ("12:30", "17:00");
            if (s.Contains("morning")) return ("07:30", "12:00");
        }
        return ("07:30", "12:00");
    }

    /// <summary>6 x 40-minute periods with a 20-minute tiffin break after the 3rd period.</summary>
    private static List<RoutinePeriodDto> BuildDefault(long classId, string start, string end, IReadOnlyList<string> days)
    {
        var list = new List<RoutinePeriodDto>();
        if (!TimeSpan.TryParse(start, CultureInfo.InvariantCulture, out var t0) ||
            !TimeSpan.TryParse(end, CultureInfo.InvariantCulture, out var tEnd)) return list;

        for (var di = 0; di < days.Count; di++)
        {
            var t = t0;
            for (var p = 1; p <= 6; p++)
            {
                var pe = t.Add(TimeSpan.FromMinutes(40));
                if (pe > tEnd) break;
                var subject = Subjects[(int)((classId + di * 2 + p - 1) % Subjects.Length)];
                list.Add(new RoutinePeriodDto(days[di], p, Fmt(t), Fmt(pe), subject, "", $"Room {100 + classId % 20}"));
                t = pe;
                if (p == 3)
                {
                    var breakEnd = t.Add(TimeSpan.FromMinutes(20));
                    if (breakEnd <= tEnd)
                    {
                        list.Add(new RoutinePeriodDto(days[di], 0, Fmt(t), Fmt(breakEnd), "Tiffin Break", "", ""));
                        t = breakEnd;
                    }
                }
            }
        }
        return list;
    }

    private static string Fmt(TimeSpan t) => $"{(int)t.TotalHours:00}:{t.Minutes:00}";

    private static string NormalizeTime(string? raw, string field)
    {
        var v = (raw ?? "").Trim();
        if (TimeSpan.TryParseExact(v, [@"hh\:mm", @"h\:mm"], CultureInfo.InvariantCulture, out var t) && t.TotalHours < 24)
            return Fmt(t);
        throw ApiException.Validation($"{field} must be a 24-hour time in HH:mm format (e.g. 07:30).");
    }

    private static string Trunc(string v, int max) => v.Length <= max ? v : v[..max];

    private static async Task AuditAsync(NpgsqlConnection conn, AdminSessionResponse admin, string action, string entityId, string details, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand("""
            INSERT INTO audit_logs (actor, role, action, entity, entity_id, details)
            VALUES (@a, @r, @act, 'class_routine', @eid, @d)
            """, conn);
        cmd.Parameters.AddWithValue("a", admin.Username);
        cmd.Parameters.AddWithValue("r", admin.Role);
        cmd.Parameters.AddWithValue("act", action);
        cmd.Parameters.AddWithValue("eid", entityId);
        cmd.Parameters.AddWithValue("d", details);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
