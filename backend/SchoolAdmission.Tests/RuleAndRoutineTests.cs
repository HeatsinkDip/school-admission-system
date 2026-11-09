using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace SchoolAdmission.Tests;

/// <summary>SINGLE_ADMISSION_PER_STUDENT=false keeps the original per-class rule of the take-home contract.</summary>
public sealed class PerClassRuleTests(PerClassRuleApiFactory factory) : IClassFixture<PerClassRuleApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task WhenDisabled_SameStudent_CanApplyToDifferentClasses()
    {
        var student = Api.NewStudentId();
        await Api.ApplyOkAsync(_client, await Api.CreateClassAsync(_client, 5), student);
        await Api.ApplyOkAsync(_client, await Api.CreateClassAsync(_client, 5), student);
    }
}

public sealed class RoutineTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<string> AdminTokenAsync(string user = "admin", string pass = "admin123")
    {
        var res = await _client.PostAsJsonAsync("/auth/admin/login", new { username = user, password = pass });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return (await Api.Json(res)).GetProperty("token").GetString()!;
    }

    private async Task<HttpResponseMessage> PutRoutineAsync(string classId, string token, object body)
    {
        using var req = new HttpRequestMessage(HttpMethod.Put, $"/admin/classes/{classId}/routine") { Content = JsonContent.Create(body) };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(req);
    }

    [Fact]
    public async Task NewClass_HasDefaultRoutine_WithFixedShiftHours()
    {
        var morning = await Api.CreateClassAsync(_client, 10, "Class 6 - Morning Shift");
        var day = await Api.CreateClassAsync(_client, 10, "Class 6 - Day Shift");

        var m = await Api.Json(await _client.GetAsync($"/classes/{morning}/routine"));
        var d = await Api.Json(await _client.GetAsync($"/classes/{day}/routine"));

        Assert.True(m.GetProperty("isDefault").GetBoolean());
        Assert.Equal("07:30", m.GetProperty("startTime").GetString());
        Assert.Equal("12:30", d.GetProperty("startTime").GetString());
        Assert.True(m.GetProperty("periods").GetArrayLength() > 0);

        var all = await Api.Json(await _client.GetAsync("/routines"));
        Assert.Contains(all.EnumerateArray(), r => r.GetProperty("classId").GetString() == morning);
    }

    [Fact]
    public async Task Admin_CanSaveRoutine_AndOverlapsAreRejected()
    {
        var classId = await Api.CreateClassAsync(_client, 10, "Class 7 - Morning Shift");
        var token = await AdminTokenAsync();

        var ok = await PutRoutineAsync(classId, token, new
        {
            startTime = "08:00",
            endTime = "12:00",
            days = new[] { "SUN", "MON" },
            periods = new[]
            {
                new { day = "SUN", period = 1, startTime = "08:00", endTime = "08:45", subject = "Mathematics", teacher = "Mr. Rahman", room = "101" },
                new { day = "SUN", period = 2, startTime = "08:45", endTime = "09:30", subject = "English", teacher = "", room = "101" },
            },
        });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var saved = await Api.Json(ok);
        Assert.False(saved.GetProperty("isDefault").GetBoolean());
        Assert.Equal(2, saved.GetProperty("periods").GetArrayLength());

        var overlap = await PutRoutineAsync(classId, token, new
        {
            startTime = "08:00",
            endTime = "12:00",
            days = new[] { "SUN" },
            periods = new[]
            {
                new { day = "SUN", period = 1, startTime = "08:00", endTime = "09:00", subject = "Bangla", teacher = "", room = "" },
                new { day = "SUN", period = 2, startTime = "08:30", endTime = "09:30", subject = "ICT", teacher = "", room = "" },
            },
        });
        await Api.AssertError(overlap, HttpStatusCode.BadRequest, "VALIDATION_ERROR");

        var unauth = await _client.PutAsJsonAsync($"/admin/classes/{classId}/routine", new { startTime = "08:00", endTime = "12:00" });
        await Api.AssertError(unauth, HttpStatusCode.Unauthorized, "UNAUTHORIZED");
    }
}

