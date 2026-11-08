using System.Text.Json;
using Npgsql;
using SchoolAdmission.Api.Contracts;
using SchoolAdmission.Api.Errors;

namespace SchoolAdmission.Api.Services;

public sealed class ClassService(NpgsqlDataSource dataSource)
{
    public const int MaxNameLength = 200;
    public const int MaxSeats = 1_000_000;

    // Seat counts are always computed from the EFFECTIVE status: a HELD row whose expires_at has
    // passed is not counted, so reads never depend on the background sweeper having run.
    private const string ClassWithCountsSql = """
        SELECT c.id, c.name, c.total_seats,
               COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()) AS held,
               COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED')                     AS confirmed
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id AND h.status IN ('HELD', 'CONFIRMED')
        """;

    public async Task<CreateClassResponse> CreateAsync(string name, int totalSeats, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand(
            "INSERT INTO classes (name, total_seats) VALUES (@name, @seats) RETURNING id");
        cmd.Parameters.AddWithValue("name", name);
        cmd.Parameters.AddWithValue("seats", totalSeats);
        var id = (long)(await cmd.ExecuteScalarAsync(ct))!;
        return new CreateClassResponse(Ids.Class(id), name, totalSeats);
    }

    public async Task<IReadOnlyList<ClassResponse>> ListAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand(ClassWithCountsSql + " GROUP BY c.id ORDER BY c.id");
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var result = new List<ClassResponse>();
        while (await reader.ReadAsync(ct)) result.Add(Read(reader));
        return result;
    }

    public async Task<ClassResponse> GetAsync(string rawId, CancellationToken ct)
    {
        var id = Ids.ParseClassOr404(rawId);
        await using var cmd = dataSource.CreateCommand(ClassWithCountsSql + " WHERE c.id = @id GROUP BY c.id");
        cmd.Parameters.AddWithValue("id", id);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw ApiException.NotFound("Class not found.");
        return Read(reader);
    }

    private static ClassResponse Read(NpgsqlDataReader r)
    {
        var total = r.GetInt32(2);
        var held = (int)r.GetInt64(3);
        var confirmed = (int)r.GetInt64(4);
        return new ClassResponse(Ids.Class(r.GetInt64(0)), r.GetString(1), total, held, confirmed,
            Math.Max(0, total - held - confirmed));
    }

    /// <summary>
    /// Parses and validates the POST /classes body by hand so that every malformed input
    /// (wrong JSON type, decimals, strings, missing fields, broken JSON) becomes a clean 400.
    /// </summary>
    public static async Task<(string Name, int TotalSeats)> ParseCreateRequestAsync(HttpRequest request, CancellationToken ct)
    {
        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(request.Body, cancellationToken: ct);
        }
        catch (JsonException)
        {
            throw ApiException.Validation("The request body must be a JSON object like { \"name\": \"Class 6 - Morning Shift\", \"totalSeats\": 120 }.");
        }

        using (doc)
        {
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                throw ApiException.Validation("The request body must be a JSON object.");

            JsonElement? nameEl = null, seatsEl = null;
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (string.Equals(prop.Name, "name", StringComparison.OrdinalIgnoreCase)) nameEl = prop.Value;
                else if (string.Equals(prop.Name, "totalSeats", StringComparison.OrdinalIgnoreCase)) seatsEl = prop.Value;
            }

            if (nameEl is not { ValueKind: JsonValueKind.String })
                throw ApiException.Validation("name is required and must be a string.");
            var name = nameEl.Value.GetString()!.Trim();
            if (name.Length == 0)
                throw ApiException.Validation("name must not be empty.");
            if (name.Length > MaxNameLength)
                throw ApiException.Validation($"name must be at most {MaxNameLength} characters.");

            if (seatsEl is not { ValueKind: JsonValueKind.Number } || !seatsEl.Value.TryGetInt32(out var seats))
                throw ApiException.Validation("totalSeats is required and must be a whole number.");
            if (seats <= 0)
                throw ApiException.Validation("totalSeats must be a positive integer.");
            if (seats > MaxSeats)
                throw ApiException.Validation($"totalSeats must be at most {MaxSeats}.");

            return (name, seats);
        }
    }
}
