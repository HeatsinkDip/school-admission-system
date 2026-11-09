using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class RoutineEndpoints
{
    public static void MapRoutineEndpoints(this IEndpointRouteBuilder app)
    {
        // Public: parents see the fixed timings and weekly routine of every class-shift.
        app.MapGet("/routines", async (RoutineService svc, CancellationToken ct) =>
            Results.Ok(await svc.ListAsync(ct)));

        app.MapGet("/classes/{classId}/routine", async (string classId, RoutineService svc, CancellationToken ct) =>
            Results.Ok(await svc.GetAsync(classId, ct)));

        // Admin: edit / reset a class routine.
        app.MapPut("/admin/classes/{classId}/routine", async (
            string classId, HttpRequest request, SaveClassRoutineRequest body,
            PortalService portal, RoutineService svc, CancellationToken ct) =>
        {
            var admin = await portal.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.SaveAsync(admin, classId, body, ct));
        });

        app.MapDelete("/admin/classes/{classId}/routine", async (
            string classId, HttpRequest request, PortalService portal, RoutineService svc, CancellationToken ct) =>
        {
            var admin = await portal.RequireAdminAsync(request, ct);
            return Results.Ok(await svc.ResetAsync(admin, classId, ct));
        });
    }
}

