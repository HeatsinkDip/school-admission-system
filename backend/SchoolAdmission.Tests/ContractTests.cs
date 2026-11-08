using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace SchoolAdmission.Tests;

public sealed class ContractTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static void AssertHasFields(JsonElement obj, params string[] fields)
    {
        Assert.Equal(JsonValueKind.Object, obj.ValueKind);
        foreach (var f in fields) Assert.True(obj.TryGetProperty(f, out _), $"missing field '{f}' in {obj}");
    }

    private static void AssertIsoUtc(JsonElement value)
    {
        var s = value.GetString()!;
        Assert.EndsWith("Z", s);
        Assert.True(DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed), s);
        Assert.Equal(DateTimeKind.Utc, parsed.Kind);
    }

    [Fact]
    public async Task ClassEndpoints_ReturnExactShapes()
    {
        var res = await _client.PostAsJsonAsync("/classes", new { name = "Class 6 - Morning Shift", totalSeats = 120 });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var created = await Api.Json(res);
        AssertHasFields(created, "id", "name", "totalSeats");
        var id = created.GetProperty("id").GetString()!;
        Assert.Equal("Class 6 - Morning Shift", created.GetProperty("name").GetString());
        Assert.Equal(120, created.GetProperty("totalSeats").GetInt32());

        var one = await Api.GetClassAsync(_client, id);
        AssertHasFields(one, "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
        Assert.Equal(id, one.GetProperty("id").GetString());
        Assert.Equal(0, one.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, one.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(120, one.GetProperty("availableSeats").GetInt32());

        var list = await Api.Json(await _client.GetAsync("/classes"));
        Assert.Equal(JsonValueKind.Array, list.ValueKind);
        var mine = list.EnumerateArray().Single(c => c.GetProperty("id").GetString() == id);
        AssertHasFields(mine, "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
    }

    [Fact]
    public async Task DuplicateClassNames_AreAllowed()
    {
        var a = await Api.CreateClassAsync(_client, 1, "Same name");
        var b = await Api.CreateClassAsync(_client, 1, "Same name");
        Assert.NotEqual(a, b);
    }

    [Fact]
    public async Task HoldEndpoints_ReturnExactShapes()
    {
        var classId = await Api.CreateClassAsync(_client, 3, "Class 7 - Day Shift");
        var student = Api.NewStudentId();

        var res = await Api.ApplyAsync(_client, classId, student);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var hold = await Api.Json(res);
        AssertHasFields(hold, "holdId", "classId", "studentId", "status", "expiresAt");
        var holdId = hold.GetProperty("holdId").GetString()!;
        Assert.Equal(classId, hold.GetProperty("classId").GetString());
        Assert.Equal(student, hold.GetProperty("studentId").GetString());
        Assert.Equal("HELD", hold.GetProperty("status").GetString());
        AssertIsoUtc(hold.GetProperty("expiresAt"));
        var expires = DateTime.Parse(hold.GetProperty("expiresAt").GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);
        Assert.InRange((expires - DateTime.UtcNow).TotalSeconds, 590, 610); // HOLD_DURATION_SECONDS=600

        // GET /holds/{id} needs no header.
        var got = await Api.GetHoldAsync(_client, holdId);
        AssertHasFields(got, "holdId", "classId", "status", "expiresAt");
        Assert.Equal("HELD", got.GetProperty("status").GetString());
        AssertIsoUtc(got.GetProperty("expiresAt"));

        var me = await Api.Json(await Api.MyHoldsAsync(_client, student));
        Assert.Equal(JsonValueKind.Array, me.ValueKind);
        var item = me.EnumerateArray().Single();
        AssertHasFields(item, "holdId", "classId", "className", "status", "expiresAt");
        Assert.Equal("Class 7 - Day Shift", item.GetProperty("className").GetString());

        var confirm = await Api.ConfirmAsync(_client, holdId, student);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var confirmed = await Api.Json(confirm);
        AssertHasFields(confirmed, "holdId", "status");
        Assert.Equal("CONFIRMED", confirmed.GetProperty("status").GetString());

        var other = Api.NewStudentId();
        var otherHold = await Api.ApplyOkAsync(_client, classId, other);
        var del = await Api.CancelAsync(_client, otherHold, other);
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
    }

    [Fact]
    public async Task MyHolds_ForStudentWithNoHolds_IsEmptyArray()
    {
        var res = await Api.MyHoldsAsync(_client, Api.NewStudentId());
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Empty((await Api.Json(res)).EnumerateArray());
    }

    public static TheoryData<string?> BadStudentIds => new()
    {
        null, "", "   ", "1234567890123456", "123456789012345678", "1234567890123456a", "abcdefghijklmnopq", "12345678901234.67",
    };

    [Theory]
    [MemberData(nameof(BadStudentIds))]
    public async Task InvalidStudentIdHeader_Is400(string? studentId)
    {
        var classId = await Api.CreateClassAsync(_client, 2);
        var holdId = await Api.ApplyOkAsync(_client, classId, Api.NewStudentId());

        await Api.AssertError(await Api.ApplyAsync(_client, classId, studentId), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Api.AssertError(await Api.ConfirmAsync(_client, holdId, studentId), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Api.AssertError(await Api.CancelAsync(_client, holdId, studentId), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        await Api.AssertError(await Api.MyHoldsAsync(_client, studentId), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Theory]
    [InlineData("""{"name":"","totalSeats":10}""")]
    [InlineData("""{"name":"   ","totalSeats":10}""")]
    [InlineData("""{"totalSeats":10}""")]
    [InlineData("""{"name":123,"totalSeats":10}""")]
    [InlineData("""{"name":"Class 6","totalSeats":0}""")]
    [InlineData("""{"name":"Class 6","totalSeats":-5}""")]
    [InlineData("""{"name":"Class 6","totalSeats":1.5}""")]
    [InlineData("""{"name":"Class 6","totalSeats":"10"}""")]
    [InlineData("""{"name":"Class 6","totalSeats":null}""")]
    [InlineData("""{"name":"Class 6"}""")]
    [InlineData("""{"name":"Class 6","totalSeats":99999999999}""")]
    [InlineData("""[1,2]""")]
    [InlineData("""not json""")]
    [InlineData("")]
    public async Task InvalidCreateClassBody_Is400(string body)
    {
        var res = await _client.PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));
        await Api.AssertError(res, HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ClassName_IsTrimmed()
    {
        var res = await _client.PostAsJsonAsync("/classes", new { name = "  Class 8 - Morning  ", totalSeats = 4 });
        Assert.Equal("Class 8 - Morning", (await Api.Json(res)).GetProperty("name").GetString());
    }
}

