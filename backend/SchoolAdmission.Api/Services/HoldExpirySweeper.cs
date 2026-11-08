using Npgsql;

namespace SchoolAdmission.Api.Services;

/// <summary>
/// Housekeeping only: periodically rewrites HELD rows whose expiry has passed to EXPIRED.
/// Correctness never depends on it (reads compute the effective status, and the apply
/// transaction expires holds itself). Safe to run in several processes at once: it uses
/// FOR UPDATE SKIP LOCKED, so it never waits on (or deadlocks with) request transactions.
/// </summary>
public sealed class HoldExpirySweeper(NpgsqlDataSource dataSource, AdmissionSettings settings, ILogger<HoldExpirySweeper> logger)
    : BackgroundService
{
    private const string SweepSql = """
        UPDATE holds SET status = 'EXPIRED'
        WHERE id IN (
            SELECT id FROM holds
            WHERE status = 'HELD' AND expires_at <= clock_timestamp()
            ORDER BY id
            LIMIT 5000
            FOR UPDATE SKIP LOCKED
        )
        """;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(settings.SweepIntervalSeconds));
        do
        {
            try
            {
                await using var cmd = dataSource.CreateCommand(SweepSql);
                var expired = await cmd.ExecuteNonQueryAsync(stoppingToken);
                if (expired > 0) logger.LogInformation("Expired {Count} hold(s).", expired);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning("Hold expiry sweep failed: {Message}", ex.Message);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }
}

