using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace SchoolAdmission.Tests;

/// <summary>
/// Hosts the real API in-process (WebApplicationFactory) against a real PostgreSQL database
/// taken from TEST_DB_CONNECTION. Every test creates its own class, so no cleanup is needed.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    protected virtual int HoldDurationSeconds => 600;
    protected virtual bool SingleAdmissionPerStudent => true;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DB_CONNECTION_STRING"] = TestDatabase.ConnectionString,
                ["HOLD_DURATION_SECONDS"] = HoldDurationSeconds.ToString(),
                ["SWEEP_INTERVAL_SECONDS"] = "1",
                ["SINGLE_ADMISSION_PER_STUDENT"] = SingleAdmissionPerStudent ? "true" : "false",
            });
        });
    }
}

/// <summary>Original per-class contract rule (SINGLE_ADMISSION_PER_STUDENT=false).</summary>
public sealed class PerClassRuleApiFactory : ApiFactory
{
    protected override bool SingleAdmissionPerStudent => false;
}

/// <summary>Holds expire after 1 second (HOLD_DURATION_SECONDS=1 test override).</summary>
public sealed class ShortHoldApiFactory : ApiFactory
{
    protected override int HoldDurationSeconds => 1;
}

public static class TestDatabase
{
    public const string DefaultConnection =
        "Host=localhost;Port=5432;Database=school_admission_test;Username=school_admin;Password=school_pass;Maximum Pool Size=15;Timeout=30";

    private static readonly Lazy<string> Lazy = new(EnsureDatabaseExists, LazyThreadSafetyMode.ExecutionAndPublication);

    public static string ConnectionString => Lazy.Value;

    /// <summary>Creates the test database on first use (the compose Postgres only creates the app DB).</summary>
    private static string EnsureDatabaseExists()
    {
        var cs = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (string.IsNullOrWhiteSpace(cs)) cs = DefaultConnection;

        var target = new NpgsqlConnectionStringBuilder(cs)
        {
            MaxPoolSize = 15,
            Timeout = 30
        };
        var dbName = target.Database ?? throw new InvalidOperationException("TEST_DB_CONNECTION must include Database=...");
        var admin = new NpgsqlConnectionStringBuilder(target.ConnectionString) { Database = "postgres", Pooling = false };

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var conn = new NpgsqlConnection(admin.ConnectionString);
                conn.Open();
                using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @n", conn);
                exists.Parameters.AddWithValue("n", dbName);
                if (exists.ExecuteScalar() is null)
                {
                    try
                    {
                        using var create = new NpgsqlCommand($"CREATE DATABASE \"{dbName.Replace("\"", "\"\"")}\"", conn);
                        create.ExecuteNonQuery();
                    }
                    catch (PostgresException ex) when (ex.SqlState is "42P04" or "23505")
                    {
                        // Created concurrently by another test process; fine.
                    }
                }
                return target.ConnectionString;
            }
            catch (NpgsqlException) when (attempt < 30)
            {
                Thread.Sleep(1000);
            }
        }
    }
}
