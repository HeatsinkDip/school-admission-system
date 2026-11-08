using Npgsql;

namespace SchoolAdmission.Api;

/// <summary>
/// Runtime settings, read from configuration (environment variables override appsettings).
/// Resolved lazily from DI so that test hosts can override them.
/// </summary>
public sealed class AdmissionSettings
{
    public const int DefaultHoldDurationSeconds = 600;
    public const int DefaultSweepIntervalSeconds = 5;
    public const int DefaultMaxPoolSize = 35;

    public const string LocalDevConnectionString =
        "Host=localhost;Port=5432;Database=school_admission;Username=school_admin;Password=school_pass";

    public required string ConnectionString { get; init; }
    public int HoldDurationSeconds { get; init; } = DefaultHoldDurationSeconds;
    public int SweepIntervalSeconds { get; init; } = DefaultSweepIntervalSeconds;

    public static AdmissionSettings FromConfiguration(IConfiguration config, ILogger? logger = null)
    {
        var rawCs = config["DB_CONNECTION_STRING"];
        if (string.IsNullOrWhiteSpace(rawCs))
        {
            logger?.LogWarning("DB_CONNECTION_STRING is not set, falling back to the local development database.");
            rawCs = LocalDevConnectionString;
        }

        // Cap the default pool size per process at 35 (unless explicitly overridden in the connection
        // string) so two backend processes sharing one PostgreSQL instance (default max_connections=100)
        // never exhaust server connections under a 200+ request burst; excess requests queue in Npgsql's pool.
        var csb = new NpgsqlConnectionStringBuilder(rawCs);
        if (!rawCs.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase) &&
            !rawCs.Contains("MaxPoolSize", StringComparison.OrdinalIgnoreCase))
        {
            csb.MaxPoolSize = DefaultMaxPoolSize;
        }
        if (!rawCs.Contains("Timeout", StringComparison.OrdinalIgnoreCase))
        {
            csb.Timeout = 30;
        }

        return new AdmissionSettings
        {
            ConnectionString = csb.ConnectionString,
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
