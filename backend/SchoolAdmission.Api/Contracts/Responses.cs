namespace SchoolAdmission.Api.Contracts;

// Response shapes. Field names are part of the public API contract; extra fields are allowed,
// but none of the required ones may be renamed or removed.

public sealed record CreateClassResponse(string Id, string Name, int TotalSeats);

public sealed record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

public sealed record CreateHoldResponse(
    string HoldId,
    string ClassId,
    string StudentId,
    string Status,
    string ExpiresAt,
    // Extra fields:
    string ClassName,
    string ServerTime);

/// <summary>Used by GET /holds/{id} and GET /me/holds.</summary>
public sealed record HoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    string ExpiresAt,
    // Extra field: lets the UI compute time left with the server clock.
    string ServerTime);

public sealed record ConfirmHoldResponse(
    string HoldId,
    string Status,
    // Extra fields:
    string ClassId,
    string ExpiresAt,
    string? ConfirmedAt,
    string ServerTime);

public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";
}
