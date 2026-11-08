namespace SchoolAdmission.Api.Errors;

/// <summary>Stable, machine-readable error codes returned in <c>{ "code", "message" }</c> bodies.</summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string NotFound = "NOT_FOUND";
    public const string NotOwner = "NOT_OWNER";
    public const string SeatsFull = "SEATS_FULL";
    public const string AlreadyApplied = "ALREADY_APPLIED";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldCancelled = "HOLD_CANCELLED";
    public const string AlreadyConfirmed = "ALREADY_CONFIRMED";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string InternalError = "INTERNAL_ERROR";
}

public sealed record ErrorBody(string Code, string Message);

/// <summary>An expected, client-facing failure that maps to a specific HTTP status and error code.</summary>
public sealed class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;

    public static ApiException Validation(string message) => new(StatusCodes.Status400BadRequest, ErrorCodes.ValidationError, message);
    public static ApiException NotFound(string message) => new(StatusCodes.Status404NotFound, ErrorCodes.NotFound, message);
    public static ApiException NotOwner() => new(StatusCodes.Status403Forbidden, ErrorCodes.NotOwner, "This application belongs to a different student.");
    public static ApiException Conflict(string code, string message) => new(StatusCodes.Status409Conflict, code, message);
}
