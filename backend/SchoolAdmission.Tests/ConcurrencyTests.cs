using System.Collections.Concurrent;
using System.Net;

namespace SchoolAdmission.Tests;

public sealed class ConcurrencyTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task TwoHundredSimultaneousApplicants_For50Seats_ExactlyFiftyGetASeat()
    {
        var client = factory.CreateClient();
        var classId = await Api.CreateClassAsync(client, seats: 50);
        var students = Enumerable.Range(0, 200).Select(_ => Api.NewStudentId()).ToArray();

        // Release all 200 requests at the same moment.
        using var gate = new ManualResetEventSlim(false);
        var tasks = students.Select(sid => Task.Run(async () =>
        {
            gate.Wait();
            return await Api.ApplyAsync(client, classId, sid);
        })).ToArray();
        gate.Set();
        var responses = await Task.WhenAll(tasks);

        var codes = responses.Select(r => r.StatusCode).ToList();
        Assert.Equal(50, codes.Count(c => c == HttpStatusCode.Created));
        Assert.Equal(150, codes.Count(c => c == HttpStatusCode.Conflict));
        foreach (var conflict in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
            await Api.AssertError(conflict, HttpStatusCode.Conflict, "SEATS_FULL");

        var cls = await Api.GetClassAsync(client, classId);
        Assert.Equal(50, cls.GetProperty("totalSeats").GetInt32());
        Assert.Equal(50, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());
    }

    [Fact]
    public async Task SameStudent_FiringManyParallelApplies_GetsExactlyOneHold()
    {
        var client = factory.CreateClient();
        var classId = await Api.CreateClassAsync(client, seats: 10);
        var student = Api.NewStudentId();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Api.ApplyAsync(client, classId, student)));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(19, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, (await Api.GetClassAsync(client, classId)).GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task ParallelConfirms_OfTheSameHold_CountOnce()
    {
        var client = factory.CreateClient();
        var classId = await Api.CreateClassAsync(client, seats: 3);
        var student = Api.NewStudentId();
        var holdId = await Api.ApplyOkAsync(client, classId, student);

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Api.ConfirmAsync(client, holdId, student)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var cls = await Api.GetClassAsync(client, classId);
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(2, cls.GetProperty("availableSeats").GetInt32());
    }
}

/// <summary>
/// Simulates the "two backend processes on one database" bonus: two independent hosts
/// (separate DI containers, connection pools and background sweepers) hammer one class.
/// </summary>
public sealed class MultiInstanceTests : IDisposable
{
    private readonly ApiFactory _instanceA = new();
    private readonly ApiFactory _instanceB = new();

    [Fact]
    public async Task TwoInstances_SharingOneDatabase_NeverOversell()
    {
        var clientA = _instanceA.CreateClient();
        var clientB = _instanceB.CreateClient();
        var classId = await Api.CreateClassAsync(clientA, seats: 30);

        var results = new ConcurrentBag<HttpStatusCode>();
        using var gate = new ManualResetEventSlim(false);
        var tasks = Enumerable.Range(0, 160).Select(i => Task.Run(async () =>
        {
            gate.Wait();
            var client = i % 2 == 0 ? clientA : clientB;
            var res = await Api.ApplyAsync(client, classId, Api.NewStudentId());
            results.Add(res.StatusCode);
        })).ToArray();
        gate.Set();
        await Task.WhenAll(tasks);

        Assert.Equal(30, results.Count(c => c == HttpStatusCode.Created));
        Assert.Equal(130, results.Count(c => c == HttpStatusCode.Conflict));

        foreach (var client in new[] { clientA, clientB })
        {
            var cls = await Api.GetClassAsync(client, classId);
            Assert.Equal(30, cls.GetProperty("heldSeats").GetInt32() + cls.GetProperty("confirmedSeats").GetInt32());
            Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());
        }
    }

    public void Dispose()
    {
        _instanceA.Dispose();
        _instanceB.Dispose();
    }
}

