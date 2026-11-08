using System.Net;

namespace SchoolAdmission.Tests;

public sealed class HoldRuleTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task SameStudent_ApplyingTwiceToSameClass_SecondIs409AlreadyApplied()
    {
        var classId = await Api.CreateClassAsync(_client, 5);
        var student = Api.NewStudentId();

        await Api.ApplyOkAsync(_client, classId, student);
        var second = await Api.ApplyAsync(_client, classId, student);

        await Api.AssertError(second, HttpStatusCode.Conflict, "ALREADY_APPLIED");
        Assert.Equal(1, (await Api.GetClassAsync(_client, classId)).GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task SameStudent_CanApplyToDifferentClasses()
    {
        var student = Api.NewStudentId();
        await Api.ApplyOkAsync(_client, await Api.CreateClassAsync(_client, 5), student);
        await Api.ApplyOkAsync(_client, await Api.CreateClassAsync(_client, 5), student);
    }

    [Fact]
    public async Task ConfirmedStudent_CannotApplyAgain_ButCancelledStudentCan()
    {
        var classId = await Api.CreateClassAsync(_client, 5);
        var confirmed = Api.NewStudentId();
        var cancelled = Api.NewStudentId();

        var h1 = await Api.ApplyOkAsync(_client, classId, confirmed);
        Assert.Equal(HttpStatusCode.OK, (await Api.ConfirmAsync(_client, h1, confirmed)).StatusCode);
        await Api.AssertError(await Api.ApplyAsync(_client, classId, confirmed), HttpStatusCode.Conflict, "ALREADY_APPLIED");

        var h2 = await Api.ApplyOkAsync(_client, classId, cancelled);
        Assert.Equal(HttpStatusCode.NoContent, (await Api.CancelAsync(_client, h2, cancelled)).StatusCode);
        await Api.ApplyOkAsync(_client, classId, cancelled);
    }

    [Fact]
    public async Task Confirm_IsIdempotent_ConfirmedSeatsIncreasesOnce()
    {
        var classId = await Api.CreateClassAsync(_client, 2);
        var student = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(_client, classId, student);

        for (var i = 0; i < 2; i++)
        {
            var res = await Api.ConfirmAsync(_client, holdId, student);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var body = await Api.Json(res);
            Assert.Equal(holdId, body.GetProperty("holdId").GetString());
            Assert.Equal("CONFIRMED", body.GetProperty("status").GetString());
        }

        var cls = await Api.GetClassAsync(_client, classId);
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());
        Assert.Equal("CONFIRMED", (await Api.GetHoldAsync(_client, holdId)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task OtherStudent_CannotConfirmOrCancel_Gets403()
    {
        var classId = await Api.CreateClassAsync(_client, 2);
        var owner = Api.NewStudentId();
        var intruder = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(_client, classId, owner);

        await Api.AssertError(await Api.ConfirmAsync(_client, holdId, intruder), HttpStatusCode.Forbidden, "NOT_OWNER");
        await Api.AssertError(await Api.CancelAsync(_client, holdId, intruder), HttpStatusCode.Forbidden, "NOT_OWNER");

        // The hold is untouched.
        Assert.Equal("HELD", (await Api.GetHoldAsync(_client, holdId)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Cancel_ReleasesSeat_IsIdempotent_AndBlocksConfirm()
    {
        var classId = await Api.CreateClassAsync(_client, 1);
        var student = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(_client, classId, student);
        await Api.AssertError(await Api.ApplyAsync(_client, classId, Api.NewStudentId()), HttpStatusCode.Conflict, "SEATS_FULL");

        Assert.Equal(HttpStatusCode.NoContent, (await Api.CancelAsync(_client, holdId, student)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Api.CancelAsync(_client, holdId, student)).StatusCode);

        Assert.Equal("CANCELLED", (await Api.GetHoldAsync(_client, holdId)).GetProperty("status").GetString());
        Assert.Equal(1, (await Api.GetClassAsync(_client, classId)).GetProperty("availableSeats").GetInt32());
        await Api.AssertError(await Api.ConfirmAsync(_client, holdId, student), HttpStatusCode.Conflict, "HOLD_CANCELLED");

        // Seat is free for someone else.
        await Api.ApplyOkAsync(_client, classId, Api.NewStudentId());
    }

    [Fact]
    public async Task CancellingAConfirmedHold_Is409()
    {
        var classId = await Api.CreateClassAsync(_client, 1);
        var student = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(_client, classId, student);
        await Api.ConfirmAsync(_client, holdId, student);

        await Api.AssertError(await Api.CancelAsync(_client, holdId, student), HttpStatusCode.Conflict, "ALREADY_CONFIRMED");
        Assert.Equal(1, (await Api.GetClassAsync(_client, classId)).GetProperty("confirmedSeats").GetInt32());
    }

    [Theory]
    [InlineData("c_999999999999")]
    [InlineData("c_abc")]
    [InlineData("123")]
    [InlineData("h_1")]
    public async Task UnknownOrMalformedClassId_Is404(string classId)
    {
        await Api.AssertError(await _client.GetAsync($"/classes/{classId}"), HttpStatusCode.NotFound, "NOT_FOUND");
        await Api.AssertError(await Api.ApplyAsync(_client, classId, Api.NewStudentId()), HttpStatusCode.NotFound, "NOT_FOUND");
    }

    [Theory]
    [InlineData("h_999999999999")]
    [InlineData("h_")]
    [InlineData("not-an-id")]
    [InlineData("c_1")]
    public async Task UnknownOrMalformedHoldId_Is404(string holdId)
    {
        var student = Api.NewStudentId();
        await Api.AssertError(await _client.GetAsync($"/holds/{holdId}"), HttpStatusCode.NotFound, "NOT_FOUND");
        await Api.AssertError(await Api.ConfirmAsync(_client, holdId, student), HttpStatusCode.NotFound, "NOT_FOUND");
        await Api.AssertError(await Api.CancelAsync(_client, holdId, student), HttpStatusCode.NotFound, "NOT_FOUND");
    }
}

