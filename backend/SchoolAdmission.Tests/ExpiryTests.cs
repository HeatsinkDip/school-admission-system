using System.Net;

namespace SchoolAdmission.Tests;

/// <summary>Runs with HOLD_DURATION_SECONDS=1.</summary>
public sealed class ExpiryTests(ShortHoldApiFactory factory) : IClassFixture<ShortHoldApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task ExpiredHold_ReleasesSeat_ReadsAsExpired_AndCannotBeConfirmed()
    {
        var classId = await Api.CreateClassAsync(_client, 1);
        var student = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(_client, classId, student);

        // While held, the only seat is taken.
        await Api.AssertError(await Api.ApplyAsync(_client, classId, Api.NewStudentId()), HttpStatusCode.Conflict, "SEATS_FULL");

        await Task.Delay(TimeSpan.FromSeconds(2.5));

        // No API call was needed to free the seat.
        var cls = await Api.GetClassAsync(_client, classId);
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());
        Assert.Equal("EXPIRED", (await Api.GetHoldAsync(_client, holdId)).GetProperty("status").GetString());

        await Api.AssertError(await Api.ConfirmAsync(_client, holdId, student), HttpStatusCode.Conflict, "HOLD_EXPIRED");
        await Api.AssertError(await Api.CancelAsync(_client, holdId, student), HttpStatusCode.Conflict, "HOLD_EXPIRED");

        var myHolds = await Api.Json(await Api.MyHoldsAsync(_client, student));
        Assert.Equal("EXPIRED", myHolds.EnumerateArray().Single().GetProperty("status").GetString());

        // The same student may apply again after expiry.
        await Api.ApplyOkAsync(_client, classId, student);
    }

    [Fact]
    public async Task ExpiredSeat_CanBeTakenByAnotherStudent()
    {
        var classId = await Api.CreateClassAsync(_client, 1);
        await Api.ApplyOkAsync(_client, classId, Api.NewStudentId());
        await Task.Delay(TimeSpan.FromSeconds(1.5));
        await Api.ApplyOkAsync(_client, classId, Api.NewStudentId());
        Assert.Equal(1, (await Api.GetClassAsync(_client, classId)).GetProperty("heldSeats").GetInt32());
    }
}

