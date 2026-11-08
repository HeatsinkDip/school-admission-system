using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Endpoints;

public static class ClassEndpoints
{
    public static IEndpointRouteBuilder MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/classes", async (HttpRequest request, ClassService classes, CancellationToken ct) =>
        {
            var (name, totalSeats) = await ClassService.ParseCreateRequestAsync(request, ct);
            var created = await classes.CreateAsync(name, totalSeats, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        app.MapGet("/classes", async (ClassService classes, CancellationToken ct) =>
            Results.Ok(await classes.ListAsync(ct)));

        app.MapGet("/classes/{classId}", async (string classId, ClassService classes, CancellationToken ct) =>
            Results.Ok(await classes.GetAsync(classId, ct)));

        return app;
    }
}
