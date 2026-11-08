using Npgsql;

namespace SchoolAdmission.Api.Data;

/// <summary>
/// Tiny versioned migration runner. Runs on startup with retry (the database may still be booting)
/// and is protected by a PostgreSQL advisory lock so several backend processes starting at the
/// same moment do not race each other.
/// </summary>
public sealed class DbMigrator(NpgsqlDataSource dataSource, ILogger<DbMigrator> logger)
{
    // Arbitrary, but fixed, key for pg_advisory_lock.
    private const long MigrationLockKey = 74_023_110_001;
    private const int MaxAttempts = 30;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);

    private static readonly (int Version, string Name, string Sql)[] Migrations =
    [
        (1, "initial_schema", """
            CREATE TABLE classes (
                id          BIGSERIAL    PRIMARY KEY,
                name        VARCHAR(200) NOT NULL,
                total_seats INTEGER      NOT NULL CHECK (total_seats > 0),
                created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
            );

            CREATE TABLE holds (
                id           BIGSERIAL   PRIMARY KEY,
                class_id     BIGINT      NOT NULL REFERENCES classes(id),
                student_id   CHAR(17)    NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
                status       VARCHAR(16) NOT NULL CHECK (status IN ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
                created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                expires_at   TIMESTAMPTZ NOT NULL,
                confirmed_at TIMESTAMPTZ NULL,
                cancelled_at TIMESTAMPTZ NULL
            );

            -- Safety net: at most one active (HELD/CONFIRMED) hold per student per class.
            CREATE UNIQUE INDEX ux_holds_active_student_class
                ON holds (class_id, student_id)
                WHERE status IN ('HELD', 'CONFIRMED');

            CREATE INDEX ix_holds_class_status ON holds (class_id, status);
            CREATE INDEX ix_holds_student      ON holds (student_id);
            CREATE INDEX ix_holds_expires_at   ON holds (expires_at);
            """),
    ];

    public async Task MigrateWithRetryAsync(CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await MigrateAsync(ct);
                return;
            }
            catch (Exception ex) when (attempt < MaxAttempts && ex is not OperationCanceledException)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}. Retrying in {Delay}s.",
                    attempt, MaxAttempts, ex.Message, RetryDelay.TotalSeconds);
                await Task.Delay(RetryDelay, ct);
            }
        }
    }

    private async Task MigrateAsync(CancellationToken ct)
    {
        await using var conn = await dataSource.OpenConnectionAsync(ct);

        await Exec(conn, null, $"SELECT pg_advisory_lock({MigrationLockKey})", ct);
        try
        {
            await Exec(conn, null, """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version    INTEGER     PRIMARY KEY,
                    name       TEXT        NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """, ct);

            var applied = new HashSet<int>();
            await using (var cmd = new NpgsqlCommand("SELECT version FROM schema_migrations", conn))
            await using (var reader = await cmd.ExecuteReaderAsync(ct))
            {
                while (await reader.ReadAsync(ct)) applied.Add(reader.GetInt32(0));
            }

            foreach (var (version, name, sql) in Migrations)
            {
                if (applied.Contains(version)) continue;

                await using var tx = await conn.BeginTransactionAsync(ct);
                await Exec(conn, tx, sql, ct);
                await using (var record = new NpgsqlCommand(
                                 "INSERT INTO schema_migrations (version, name) VALUES (@v, @n)", conn, tx))
                {
                    record.Parameters.AddWithValue("v", version);
                    record.Parameters.AddWithValue("n", name);
                    await record.ExecuteNonQueryAsync(ct);
                }
                await tx.CommitAsync(ct);
                logger.LogInformation("Applied migration {Version} ({Name}).", version, name);
            }

            logger.LogInformation("Database schema is up to date.");
        }
        finally
        {
            await Exec(conn, null, $"SELECT pg_advisory_unlock({MigrationLockKey})", CancellationToken.None);
        }
    }

    private static async Task Exec(NpgsqlConnection conn, NpgsqlTransaction? tx, string sql, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand(sql, conn, tx);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
