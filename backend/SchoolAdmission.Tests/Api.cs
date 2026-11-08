using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests;

public static class Api
{
    private static long _counter = Random.Shared.NextInt64(0, 1_000_000_000);
    private static readonly string RunPrefix = Random.Shared.Next(1000000, 9999999).ToString();

    /// <summary>A fresh, valid 17-digit registration number (7-digit run prefix + 10-digit counter).</summary>
    public static string NewStudentId() =>
        RunPrefix + (Interlocked.Increment(ref _counter) % 10_000_000_000).ToString("D10");

    public static async Task<string> CreateClassAsync(HttpClient client, int seats, string name = "Class 6 - Morning Shift")
    {
        var res = await client.PostAsJsonAsync("/classes", new { name, totalSeats = seats });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetString()!;
    }

    public static Task<HttpResponseMessage> ApplyAsync(HttpClient client, string classId, string? studentId) =>
        SendAsync(client, HttpMethod.Post, $"/classes/{classId}/holds", studentId);

    public static Task<HttpResponseMessage> ConfirmAsync(HttpClient client, string holdId, string? studentId) =>
        SendAsync(client, HttpMethod.Post, $"/holds/{holdId}/confirm", studentId);

    public static Task<HttpResponseMessage> CancelAsync(HttpClient client, string holdId, string? studentId) =>
        SendAsync(client, HttpMethod.Delete, $"/holds/{holdId}", studentId);

    public static Task<HttpResponseMessage> MyHoldsAsync(HttpClient client, string? studentId) =>
        SendAsync(client, HttpMethod.Get, "/me/holds", studentId);

    public static async Task<string> ApplyOkAsync(HttpClient client, string classId, string studentId)
    {
        var res = await ApplyAsync(client, classId, studentId);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await Json(res)).GetProperty("holdId").GetString()!;
    }

    public static async Task<JsonElement> GetClassAsync(HttpClient client, string classId)
    {
        var res = await client.GetAsync($"/classes/{classId}");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await Json(res);
    }

    public static async Task<JsonElement> GetHoldAsync(HttpClient client, string holdId)
    {
        var res = await client.GetAsync($"/holds/{holdId}");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await Json(res);
    }

    public static async Task<JsonElement> Json(HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<JsonElement>();

    public static async Task AssertError(HttpResponseMessage res, HttpStatusCode status, string code)
    {
        Assert.Equal(status, res.StatusCode);
        var body = await Json(res);
        Assert.Equal(code, body.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string url, string? studentId)
    {
        var req = new HttpRequestMessage(method, url);
        if (studentId is not null) req.Headers.TryAddWithoutValidation("X-Student-Id", studentId);
        return client.SendAsync(req);
    }
}

