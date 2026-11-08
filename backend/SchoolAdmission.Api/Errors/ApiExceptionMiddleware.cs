using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;
using Npgsql;

namespace SchoolAdmission.Api.Errors;

/// <summary>
/// Converts exceptions into the uniform <c>{ "code", "message" }</c> error body.
/// Client mistakes never surface as 500.
/// </summary>
public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger, IOptions<JsonOptions> jsonOptions)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            var (status, body) = Map(ex);
            if (status >= 500) logger.LogError(ex, "Unhandled error for {Method} {Path}", context.Request.Method, context.Request.Path);

            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json; charset=utf-8";
            await JsonSerializer.SerializeAsync(context.Response.Body, body, jsonOptions.Value.SerializerOptions);
        }
    }

    private static (int Status, ErrorBody Body) Map(Exception ex) => ex switch
    {
        ApiException api => (api.StatusCode, new ErrorBody(api.Code, api.Message)),
        BadHttpRequestException bad => (StatusCodes.Status400BadRequest,
            new ErrorBody(ErrorCodes.ValidationError, "The request could not be read: " + bad.Message)),
        JsonException => (StatusCodes.Status400BadRequest,
            new ErrorBody(ErrorCodes.ValidationError, "The request body is not valid JSON.")),
        NpgsqlException or TimeoutException => (StatusCodes.Status503ServiceUnavailable,
            new ErrorBody(ErrorCodes.ServiceUnavailable, "The service is temporarily unavailable. Please try again.")),
        _ => (StatusCodes.Status500InternalServerError,
            new ErrorBody(ErrorCodes.InternalError, "Something went wrong on the server.")),
    };
}
