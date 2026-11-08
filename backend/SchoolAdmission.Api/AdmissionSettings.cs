namespace SchoolAdmission.Api;

/// <summary>
/// Runtime settings, read from configuration (environment variables override appsettings).
/// Resolved lazily from DI so that test hosts can override them.
/// </summary>
public sealed class AdmissionSettings
{
    public const int DefaultHoldDurationSeconds = 600;
    public const int DefaultSweepIntervalSeconds = 5;

    public const string LocalDevConnectionString =
        "Host=localhost;Port=5433;Database=school_admission;Username=school;Password=school";

    public required string ConnectionString { get; init; }
    public int HoldDurationSeconds { get; init; } = DefaultHoldDurationSeconds;
    public int SweepIntervalSeconds { get; init; } = DefaultSweepIntervalSeconds;

    public static AdmissionSettings FromConfiguration(IConfiguration config, ILogger? logger = null)
    {
        var cs = config["DB_CONNECTION_STRING"];
        if (string.IsNullOrWhiteSpace(cs))
        {
            logger?.LogWarning("DB_CONNECTION_STRING is not set, falling back to the local development database.");
            cs = LocalDevConnectionString;
        }

        return new AdmissionSettings
        {
            ConnectionString = cs,
            HoldDurationSeconds = ReadPositiveInt(config, "HOLD_DURATION_SECONDS", DefaultHoldDurationSeconds, logger),
            SweepIntervalSeconds = ReadPositiveInt(config, "SWEEP_INTERVAL_SECONDS", DefaultSweepIntervalSeconds, logger),
        };
    }

    private static int ReadPositiveInt(IConfiguration config, string key, int fallback, ILogger? logger)
    {
        var raw = config[key];
        if (string.IsNullOrWhiteSpace(raw)) return fallback;
        if (int.TryParse(raw.Trim(), out var value) && value > 0) return value;
        logger?.LogWarning("{Key}='{Value}' is not a positive integer, using default {Default}.", key, raw, fallback);
        return fallback;
    }
}
