using Npgsql;
using SchoolAdmission.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Endpoints;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Settings are resolved from DI (not read eagerly here) so integration tests can override them.
builder.Services.AddSingleton(sp => AdmissionSettings.FromConfiguration(
    sp.GetRequiredService<IConfiguration>(),
    sp.GetRequiredService<ILoggerFactory>().CreateLogger<AdmissionSettings>()));
builder.Services.AddSingleton(sp =>
    new NpgsqlDataSourceBuilder(sp.GetRequiredService<AdmissionSettings>().ConnectionString).Build());
builder.Services.AddSingleton<DbMigrator>();
builder.Services.AddSingleton<ClassService>();
builder.Services.AddSingleton<HoldService>();
builder.Services.AddHostedService<HoldExpirySweeper>();

// CORS: CORS_ALLOWED_ORIGINS is a comma separated list, or "*" (default) for any origin.
// The Date header is exposed so the UI could also derive the server clock from it.
builder.Services.AddCors();
builder.Services.AddOptions<Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions>()
    .Configure<IConfiguration>((options, config) =>
    {
        var origins = (config["CORS_ALLOWED_ORIGINS"] ?? "*")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        options.AddDefaultPolicy(policy =>
        {
            if (origins.Length == 0 || origins.Contains("*")) policy.AllowAnyOrigin();
            else policy.WithOrigins(origins);
            policy.AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("Date");
        });
    });

var app = builder.Build();

await app.Services.GetRequiredService<DbMigrator>().MigrateWithRetryAsync(app.Lifetime.ApplicationStopping);

app.UseCors();
app.UseMiddleware<ApiExceptionMiddleware>();

app.MapClassEndpoints();
app.MapHoldEndpoints();

// Unknown routes get the same JSON error shape.
app.MapFallback(() => Results.Json(new ErrorBody(ErrorCodes.NotFound, "Resource not found."), statusCode: StatusCodes.Status404NotFound));

app.Run();

// Exposed for WebApplicationFactory in the integration tests.
public partial class Program;

