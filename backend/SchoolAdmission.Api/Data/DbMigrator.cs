using System.Security.Cryptography;
using System.Text;
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

    public static string HashPassword(string plain) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("school-salt-v1:" + plain))).ToLowerInvariant();

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

        (2, "extended_portal_schema", $$"""
            ALTER TABLE classes
                ADD COLUMN IF NOT EXISTS shift               VARCHAR(50)   NOT NULL DEFAULT 'Morning',
                ADD COLUMN IF NOT EXISTS academic_year       VARCHAR(20)   NOT NULL DEFAULT '2027',
                ADD COLUMN IF NOT EXISTS min_age             INTEGER       NULL,
                ADD COLUMN IF NOT EXISTS max_age             INTEGER       NULL,
                ADD COLUMN IF NOT EXISTS status              VARCHAR(20)   NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
                ADD COLUMN IF NOT EXISTS admission_fee       NUMERIC(12,2) NOT NULL DEFAULT 15000,
                ADD COLUMN IF NOT EXISTS session_charge      NUMERIC(12,2) NOT NULL DEFAULT 8000,
                ADD COLUMN IF NOT EXISTS development_fee     NUMERIC(12,2) NOT NULL DEFAULT 10000,
                ADD COLUMN IF NOT EXISTS security_deposit    NUMERIC(12,2) NOT NULL DEFAULT 5000,
                ADD COLUMN IF NOT EXISTS first_month_tuition NUMERIC(12,2) NOT NULL DEFAULT 6000,
                ADD COLUMN IF NOT EXISTS monthly_tuition     NUMERIC(12,2) NOT NULL DEFAULT 6000,
                ADD COLUMN IF NOT EXISTS exam_fee            NUMERIC(12,2) NOT NULL DEFAULT 1500,
                ADD COLUMN IF NOT EXISTS lab_fee             NUMERIC(12,2) NOT NULL DEFAULT 500;

            CREATE TABLE IF NOT EXISTS admin_users (
                id            BIGSERIAL    PRIMARY KEY,
                username      VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(256) NOT NULL,
                role          VARCHAR(50)  NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMISSION_OFFICER', 'ACCOUNTANT')),
                full_name     VARCHAR(200) NOT NULL,
                created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
            );

            INSERT INTO admin_users (username, password_hash, role, full_name)
            VALUES
                ('admin',      '{{HashPassword("admin123")}}',      'SUPER_ADMIN',       'Principal / Super Admin'),
                ('officer',    '{{HashPassword("officer123")}}',    'ADMISSION_OFFICER', 'Senior Admission Officer'),
                ('accountant', '{{HashPassword("accountant123")}}', 'ACCOUNTANT',        'Chief Finance Officer')
            ON CONFLICT (username) DO NOTHING;

            CREATE TABLE IF NOT EXISTS admin_sessions (
                token      VARCHAR(128) PRIMARY KEY,
                username   VARCHAR(100) NOT NULL,
                role       VARCHAR(50)  NOT NULL,
                full_name  VARCHAR(200) NOT NULL,
                created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
                expires_at TIMESTAMPTZ  NOT NULL
            );

            CREATE TABLE IF NOT EXISTS student_profiles (
                student_id           CHAR(17)      PRIMARY KEY CHECK (student_id ~ '^[0-9]{17}$'),
                full_name_en         VARCHAR(200)  NOT NULL DEFAULT '',
                full_name_bn         VARCHAR(200)  NOT NULL DEFAULT '',
                dob                  VARCHAR(30)   NOT NULL DEFAULT '',
                gender               VARCHAR(30)   NOT NULL DEFAULT '',
                nationality          VARCHAR(100)  NOT NULL DEFAULT 'Bangladeshi',
                religion             VARCHAR(50)   NOT NULL DEFAULT '',
                blood_group          VARCHAR(16)   NOT NULL DEFAULT '',
                present_address      TEXT          NOT NULL DEFAULT '',
                permanent_address    TEXT          NOT NULL DEFAULT '',
                previous_school      VARCHAR(200)  NOT NULL DEFAULT '',
                last_class_passed    VARCHAR(50)   NOT NULL DEFAULT '',
                last_result          VARCHAR(50)   NOT NULL DEFAULT '',
                health_notes         TEXT          NOT NULL DEFAULT '',
                has_sibling          BOOLEAN       NOT NULL DEFAULT FALSE,
                sibling_name         VARCHAR(200)  NOT NULL DEFAULT '',
                sibling_class        VARCHAR(100)  NOT NULL DEFAULT '',
                sibling_student_id   VARCHAR(50)   NOT NULL DEFAULT '',
                father_name          VARCHAR(200)  NOT NULL DEFAULT '',
                father_nid           VARCHAR(50)   NOT NULL DEFAULT '',
                father_occupation    VARCHAR(100)  NOT NULL DEFAULT '',
                father_employer      VARCHAR(150)  NOT NULL DEFAULT '',
                father_phone         VARCHAR(40)   NOT NULL DEFAULT '',
                father_email         VARCHAR(150)  NOT NULL DEFAULT '',
                mother_name          VARCHAR(200)  NOT NULL DEFAULT '',
                mother_nid           VARCHAR(50)   NOT NULL DEFAULT '',
                mother_occupation    VARCHAR(100)  NOT NULL DEFAULT '',
                mother_employer      VARCHAR(150)  NOT NULL DEFAULT '',
                mother_phone         VARCHAR(40)   NOT NULL DEFAULT '',
                mother_email         VARCHAR(150)  NOT NULL DEFAULT '',
                guardian_name        VARCHAR(200)  NOT NULL DEFAULT '',
                guardian_relation    VARCHAR(50)   NOT NULL DEFAULT 'Father',
                guardian_phone       VARCHAR(40)   NOT NULL DEFAULT '',
                emergency_contact    VARCHAR(100)  NOT NULL DEFAULT '',
                monthly_income       NUMERIC(12,2) NOT NULL DEFAULT 0,
                income_bracket       VARCHAR(50)   NOT NULL DEFAULT '',
                income_source        VARCHAR(100)  NOT NULL DEFAULT '',
                dependents           INTEGER       NOT NULL DEFAULT 1,
                concession_requested BOOLEAN       NOT NULL DEFAULT FALSE,
                concession_status    VARCHAR(30)   NOT NULL DEFAULT 'NONE',
                concession_percent   INTEGER       NOT NULL DEFAULT 0,
                concession_note      TEXT          NOT NULL DEFAULT '',
                documents_json       JSONB         NOT NULL DEFAULT '[]'::jsonb,
                application_status   VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
                reviewer_note        TEXT          NOT NULL DEFAULT '',
                assigned_section     VARCHAR(50)   NOT NULL DEFAULT '',
                enrolled_student_no  VARCHAR(50)   NOT NULL DEFAULT '',
                updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS payments (
                id              BIGSERIAL     PRIMARY KEY,
                hold_id         BIGINT        NOT NULL UNIQUE REFERENCES holds(id),
                class_id        BIGINT        NOT NULL REFERENCES classes(id),
                student_id      CHAR(17)      NOT NULL,
                receipt_no      VARCHAR(64)   NOT NULL,
                gross_amount    NUMERIC(12,2) NOT NULL,
                discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                discount_reason VARCHAR(200)  NOT NULL DEFAULT '',
                net_amount      NUMERIC(12,2) NOT NULL,
                gateway         VARCHAR(50)   NOT NULL DEFAULT 'MOCK_GATEWAY',
                status          VARCHAR(30)   NOT NULL DEFAULT 'SUCCESS',
                refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                refund_reason   TEXT          NOT NULL DEFAULT '',
                paid_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS ix_payments_student ON payments (student_id);

            CREATE TABLE IF NOT EXISTS waitlist (
                id         BIGSERIAL   PRIMARY KEY,
                class_id   BIGINT      NOT NULL REFERENCES classes(id),
                student_id CHAR(17)    NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (class_id, student_id)
            );

            CREATE TABLE IF NOT EXISTS school_settings (
                key        VARCHAR(100) PRIMARY KEY,
                value      TEXT         NOT NULL,
                updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
            );

            INSERT INTO school_settings (key, value)
            VALUES
                ('academic_year',             '2027'),
                ('admission_opens_at',        '2026-01-01T00:00:00Z'),
                ('admission_closes_at',       '2027-12-31T23:59:59Z'),
                ('paperwork_deadline_days',   '7'),
                ('waitlist_enabled',          'true'),
                ('sibling_discount_percent',  '10')
            ON CONFLICT (key) DO NOTHING;

            CREATE TABLE IF NOT EXISTS audit_logs (
                id         BIGSERIAL    PRIMARY KEY,
                actor      VARCHAR(100) NOT NULL,
                role       VARCHAR(50)  NOT NULL,
                action     VARCHAR(100) NOT NULL,
                entity     VARCHAR(100) NOT NULL,
                entity_id  VARCHAR(100) NOT NULL,
                details    TEXT         NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
            );
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
