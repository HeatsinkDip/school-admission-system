using System.Globalization;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api;

/// <summary>
/// Public IDs are the numeric primary key with a type prefix: <c>c_42</c> for classes, <c>h_42</c> for holds.
/// Anything that does not parse is treated as "not found" (404), never as a server error.
/// </summary>
public static class Ids
{
    public const string ClassPrefix = "c_";
    public const string HoldPrefix = "h_";

    public static string Class(long id) => ClassPrefix + id.ToString(CultureInfo.InvariantCulture);
    public static string Hold(long id) => HoldPrefix + id.ToString(CultureInfo.InvariantCulture);

    public static long ParseClassOr404(string? raw) =>
        TryParse(raw, ClassPrefix, out var id) ? id : throw ApiException.NotFound("Class not found.");

    public static long ParseHoldOr404(string? raw) =>
        TryParse(raw, HoldPrefix, out var id) ? id : throw ApiException.NotFound("Application (hold) not found.");

    private static bool TryParse(string? raw, string prefix, out long id)
    {
        id = 0;
        if (raw is null || !raw.StartsWith(prefix, StringComparison.Ordinal)) return false;
        var digits = raw.AsSpan(prefix.Length);
        if (digits.Length is 0 or > 18) return false;
        foreach (var ch in digits)
            if (ch is < '0' or > '9') return false;
        return long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out id) && id > 0;
    }
}

public static class StudentIds
{
    public const string HeaderName = "X-Student-Id";

    /// <summary>Reads and validates the X-Student-Id header: exactly 17 ASCII digits, otherwise 400.</summary>
    public static string FromHeaderOr400(HttpRequest request)
    {
        var values = request.Headers[HeaderName];
        if (values.Count == 0 || string.IsNullOrWhiteSpace(values[0]))
            throw ApiException.Validation("The X-Student-Id header (17-digit registration number) is required.");
        if (values.Count > 1)
            throw ApiException.Validation("Send exactly one X-Student-Id header.");

        var value = values[0]!.Trim();
        if (!IsValid(value))
            throw ApiException.Validation("X-Student-Id must be exactly 17 digits.");
        return value;
    }

    public static bool IsValid(string value)
    {
        if (value.Length != 17) return false;
        foreach (var ch in value)
            if (ch is < '0' or > '9') return false;
        return true;
    }

    public static string ValidateOr400(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || !IsValid(value.Trim()))
            throw ApiException.Validation("Student ID must be exactly 17 digits.");
        return value.Trim();
    }
}

public static class Iso
{
    /// <summary>ISO-8601 UTC with millisecond precision and a trailing Z, e.g. 2026-11-01T04:10:00.000Z.</summary>
    public static string Format(DateTime value) =>
        DateTime.SpecifyKind(value.ToUniversalTime(), DateTimeKind.Utc)
            .ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
}
