using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Errors;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class PortalEndpoints
{
    public static void MapPortalEndpoints(this IEndpointRouteBuilder app)
    {
        // =====================================================================
        // Admin Authentication (/auth/admin/*)
        // =====================================================================

        app.MapPost("/auth/admin/login", async (AdminLoginRequest req, PortalService svc, CancellationToken ct) =>
            Results.Ok(await svc.LoginAdminAsync(req, ct)));

        app.MapGet("/auth/admin/me", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
            Results.Ok(await svc.RequireAdminAsync(request, ct)));

        app.MapPost("/auth/admin/logout", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.LogoutAdminAsync(request, ct);
            return Results.NoContent();
        });

        // =====================================================================
        // Parent Portal (/parent/*) — uses X-Student-Id header
        // =====================================================================

        app.MapGet("/parent/profile", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await svc.GetStudentProfileAsync(studentId, ct));
        });

        app.MapPut("/parent/profile", async (HttpRequest request, SaveStudentProfileRequest body, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await svc.SaveStudentProfileAsync(studentId, body, ct));
        });

        app.MapPost("/parent/documents", async (HttpRequest request, UploadDocumentRequest body, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await svc.UploadDocumentAsync(studentId, body, ct));
        });

        app.MapGet("/parent/classes/{classId}/fees", async (string classId, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            string? studentId = null;
            if (request.Headers.TryGetValue(StudentIds.HeaderName, out var vals) && vals.Count > 0)
                studentId = vals[0]?.Trim();
            return Results.Ok(await svc.GetClassFeeBreakdownAsync(classId, studentId, ct));
        });

        app.MapGet("/parent/payments", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await svc.ListStudentPaymentsAsync(studentId, ct));
        });

        app.MapPost("/parent/classes/{classId}/waitlist", async (string classId, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            var created = await svc.JoinWaitlistAsync(classId, studentId, ct);
            return Results.Created($"/parent/waitlist/{created.Id}", created);
        });

        app.MapGet("/parent/waitlist", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await svc.ListStudentWaitlistAsync(studentId, ct));
        });

        app.MapGet("/notifications", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            string? studentId = null;
            if (request.Headers.TryGetValue(StudentIds.HeaderName, out var vals) && vals.Count > 0)
                studentId = vals[0]?.Trim();
            return Results.Ok(await svc.ListNotificationsAsync(studentId, ct));
        });

        app.MapPost("/notifications/{id:long}/read", async (long id, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            string? studentId = null;
            if (request.Headers.TryGetValue(StudentIds.HeaderName, out var vals) && vals.Count > 0)
                studentId = vals[0]?.Trim();
            await svc.MarkNotificationReadAsync(id, studentId, ct);
            return Results.NoContent();
        });

        app.MapPost("/notifications/mark-all-read", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            string? studentId = null;
            if (request.Headers.TryGetValue(StudentIds.HeaderName, out var vals) && vals.Count > 0)
                studentId = vals[0]?.Trim();
            await svc.MarkAllNotificationsReadAsync(studentId, ct);
            return Results.NoContent();
        });

        // =====================================================================
        // Admin Console (/admin/*) — requires Admin Bearer / X-Admin-Token
        // =====================================================================

        app.MapGet("/admin/dashboard", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.GetDashboardAsync(ct));
        });

        app.MapPut("/admin/settings", async (HttpRequest request, UpdateSchoolSettingsRequest body, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.UpdateSettingsAsync(admin, body, ct));
        });

        app.MapPost("/admin/classes", async (HttpRequest request, UpsertAdminClassRequest body, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            var created = await svc.CreateAdminClassAsync(admin, body, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        app.MapPut("/admin/classes/{classId}", async (string classId, HttpRequest request, UpsertAdminClassRequest body, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.UpdateAdminClassAsync(admin, classId, body, ct));
        });

        app.MapDelete("/admin/classes/{classId}", async (string classId, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            await svc.DeleteAdminClassAsync(admin, classId, ct);
            return Results.NoContent();
        });

        app.MapGet("/admin/applications", async (
            HttpRequest request,
            string? classId,
            string? holdStatus,
            string? applicationStatus,
            string? search,
            PortalService svc,
            CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ListAdminApplicationsAsync(classId, holdStatus, applicationStatus, search, ct));
        });

        app.MapGet("/admin/applications/{studentId}", async (string studentId, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.GetAdminApplicationDetailAsync(studentId, ct));
        });

        app.MapPut("/admin/applications/{studentId}", async (string studentId, HttpRequest request, SaveStudentProfileRequest body, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.SaveStudentProfileAsync(studentId, body, ct));
        });

        app.MapDelete("/admin/applications/{studentId}", async (string studentId, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            await svc.DeleteStudentApplicationAsync(admin, studentId, ct);
            return Results.NoContent();
        });

        app.MapPost("/admin/applications/{studentId}/review", async (
            string studentId,
            HttpRequest request,
            AdminReviewDecisionRequest body,
            PortalService svc,
            CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ReviewApplicationAsync(admin, studentId, body, ct));
        });

        app.MapPost("/admin/applications/{studentId}/documents/verify", async (
            string studentId,
            HttpRequest request,
            AdminVerifyDocumentRequest body,
            PortalService svc,
            CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.VerifyDocumentAsync(admin, studentId, body, ct));
        });

        app.MapPost("/admin/applications/{studentId}/concession", async (
            string studentId,
            HttpRequest request,
            AdminConcessionDecisionRequest body,
            PortalService svc,
            CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ReviewConcessionAsync(admin, studentId, body, ct));
        });

        app.MapGet("/admin/payments", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ListAdminPaymentsAsync(ct));
        });

        app.MapPost("/admin/payments/{paymentId:long}/refund", async (
            long paymentId,
            HttpRequest request,
            AdminRefundRequest body,
            PortalService svc,
            CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.RefundPaymentAsync(admin, paymentId, body, ct));
        });

        app.MapGet("/admin/waitlist", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ListAdminWaitlistAsync(ct));
        });

        app.MapGet("/admin/audit-logs", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ListAuditLogsAsync(ct));
        });

        app.MapGet("/admin/notifications", async (HttpRequest request, string? category, bool? unreadOnly, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ListAdminNotificationsAsync(category, unreadOnly ?? false, ct));
        });

        app.MapPost("/admin/notifications/{id:long}/read", async (long id, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            await svc.MarkAdminNotificationReadAsync(id, ct);
            return Results.NoContent();
        });

        app.MapPost("/admin/notifications/mark-all-read", async (HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            await svc.MarkAllAdminNotificationsReadAsync(ct);
            return Results.NoContent();
        });

        app.MapPost("/admin/notifications/broadcast", async (HttpRequest request, BroadcastNotificationRequest body, PortalService svc, CancellationToken ct) =>
        {
            var admin = await svc.RequireAdminAsync(request, ct);
            var created = await svc.BroadcastNotificationAsync(admin, body, ct);
            return Results.Created($"/notifications/{created.Id}", created);
        });

        app.MapDelete("/admin/notifications/{id:long}", async (long id, HttpRequest request, PortalService svc, CancellationToken ct) =>
        {
            await svc.RequireAdminAsync(request, ct);
            await svc.DeleteAdminNotificationAsync(id, ct);
            return Results.NoContent();
        });
    }
}

