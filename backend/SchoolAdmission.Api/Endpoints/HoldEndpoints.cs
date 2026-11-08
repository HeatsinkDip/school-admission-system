using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class HoldEndpoints
{
    public static IEndpointRouteBuilder MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            var hold = await holds.ApplyAsync(classId, studentId, ct);
            return Results.Created($"/holds/{hold.HoldId}", hold);
        });

        // No X-Student-Id required (anyone with the hold id can read its status).
        app.MapGet("/holds/{holdId}", async (string holdId, HoldService holds, CancellationToken ct) =>
            Results.Ok(await holds.GetAsync(holdId, ct)));

        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await holds.ConfirmAsync(holdId, studentId, ct));
        });

        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            await holds.CancelAsync(holdId, studentId, ct);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", async (HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var studentId = StudentIds.FromHeaderOr400(request);
            return Results.Ok(await holds.ListForStudentAsync(studentId, ct));
        });

        return app;
    }
}
