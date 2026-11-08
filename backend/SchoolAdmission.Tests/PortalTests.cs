using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests;

public sealed class PortalTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task AdminEndpoints_RequirePasswordAuthentication()
    {
        var unauth = await _client.GetAsync("/admin/dashboard");
        await Api.AssertError(unauth, HttpStatusCode.Unauthorized, "UNAUTHORIZED");

        var badLogin = await _client.PostAsJsonAsync("/auth/admin/login", new { username = "admin", password = "wrong-password" });
        await Api.AssertError(badLogin, HttpStatusCode.Unauthorized, "INVALID_CREDENTIALS");

        var goodLogin = await _client.PostAsJsonAsync("/auth/admin/login", new { username = "admin", password = "admin123" });
        Assert.Equal(HttpStatusCode.OK, goodLogin.StatusCode);
        var session = await Api.Json(goodLogin);
        var token = session.GetProperty("token").GetString()!;
        Assert.Equal("SUPER_ADMIN", session.GetProperty("role").GetString());

        using var req = new HttpRequestMessage(HttpMethod.Get, "/admin/dashboard");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var dashRes = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, dashRes.StatusCode);
    }

    [Fact]
    public async Task ParentChildProfile_SiblingDiscount_AndAdminReviewWorkflow()
    {
        // 1. Admin logs in and creates a class with default fee structure (44,000 BDT payable at confirmation)
        var loginRes = await _client.PostAsJsonAsync("/auth/admin/login", new { username = "admin", password = "admin123" });
        var token = (await Api.Json(loginRes)).GetProperty("token").GetString()!;

        using var createClassReq = new HttpRequestMessage(HttpMethod.Post, "/admin/classes")
        {
            Content = JsonContent.Create(new
            {
                name = "Class 6 - Morning Shift (2027)",
                shift = "Morning",
                academicYear = "2027",
                totalSeats = 2,
                minAge = 10,
                maxAge = 13,
                status = "OPEN"
            })
        };
        createClassReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var createClassRes = await _client.SendAsync(createClassReq);
        Assert.Equal(HttpStatusCode.Created, createClassRes.StatusCode);
        var classId = (await Api.Json(createClassRes)).GetProperty("id").GetString()!;

        // 2. Parent fills out child profile with a sibling studying in the school + need-based concession request
        var studentId = Api.NewStudentId();
        using var saveProfileReq = new HttpRequestMessage(HttpMethod.Put, "/parent/profile")
        {
            Content = JsonContent.Create(new
            {
                fullNameEn = "Aarav Rahman",
                fullNameBn = "আরভ রহমান",
                dob = "2015-05-14",
                gender = "Male",
                bloodGroup = "O+",
                presentAddress = "House 12, Road 5, Dhanmondi, Dhaka",
                fatherName = "Kamal Rahman",
                fatherPhone = "01711223344",
                motherName = "Nadia Rahman",
                hasSibling = true,
                siblingName = "Zara Rahman",
                siblingClass = "Class 8 - Morning",
                siblingStudentId = "STU-2025-1042",
                monthlyIncome = 35000,
                incomeBracket = "25,000 - 50,000 BDT",
                concessionRequested = true,
                submitForReview = true
            })
        };
        saveProfileReq.Headers.Add("X-Student-Id", studentId);
        var profileRes = await _client.SendAsync(saveProfileReq);
        Assert.Equal(HttpStatusCode.OK, profileRes.StatusCode);
        var profileJson = await Api.Json(profileRes);
        Assert.Equal("Aarav Rahman", profileJson.GetProperty("fullNameEn").GetString());
        Assert.Equal("SUBMITTED", profileJson.GetProperty("applicationStatus").GetString());
        Assert.Equal("PENDING", profileJson.GetProperty("concessionStatus").GetString());

        // 3. Parent applies for a seat and confirms payment
        var holdId = await Api.ApplyOkAsync(_client, classId, studentId);
        var confirmRes = await Api.ConfirmAsync(_client, holdId, studentId);
        Assert.Equal(HttpStatusCode.OK, confirmRes.StatusCode);

        // 4. Verify automatic invoice & payment receipt with 10% sibling discount on Admission Fee (15,000 * 10% = 1,500 -> Net 42,500)
        using var payReq = new HttpRequestMessage(HttpMethod.Get, "/parent/payments");
        payReq.Headers.Add("X-Student-Id", studentId);
        var payRes = await _client.SendAsync(payReq);
        Assert.Equal(HttpStatusCode.OK, payRes.StatusCode);
        var payments = (await Api.Json(payRes)).EnumerateArray().ToList();
        Assert.Single(payments);
        Assert.Equal(44000m, payments[0].GetProperty("grossAmount").GetDecimal());
        Assert.Equal(1500m, payments[0].GetProperty("discountAmount").GetDecimal());
        Assert.Equal(42500m, payments[0].GetProperty("netAmount").GetDecimal());

        // 5. Admin cannot reduce totalSeats below confirmedSeats (1) -> Wait: totalSeats must be > 0, so test with 2 confirmed seats and reducing to 1
        var secondStudent = Api.NewStudentId();
        var secondHold = await Api.ApplyOkAsync(_client, classId, secondStudent);
        using var reduceReq = new HttpRequestMessage(HttpMethod.Put, $"/admin/classes/{classId}")
        {
            Content = JsonContent.Create(new { name = "Class 6 - Morning Shift (2027)", totalSeats = 1 })
        };
        reduceReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var reduceRes = await _client.SendAsync(reduceReq);
        await Api.AssertError(reduceRes, HttpStatusCode.Conflict, "SEAT_REDUCTION_CONFLICT");

        // 6. Admin approves the first student's application and enrolls them
        using var reviewReq = new HttpRequestMessage(HttpMethod.Post, $"/admin/applications/{studentId}/review")
        {
            Content = JsonContent.Create(new
            {
                action = "ENROLL",
                note = "Documents verified and enrolled.",
                assignedSection = "Section A",
                enrolledStudentNo = "STU-2027-0001"
            })
        };
        reviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var reviewRes = await _client.SendAsync(reviewReq);
        Assert.Equal(HttpStatusCode.OK, reviewRes.StatusCode);
        var reviewed = await Api.Json(reviewRes);
        Assert.Equal("ENROLLED", reviewed.GetProperty("profile").GetProperty("applicationStatus").GetString());
        Assert.Equal("Section A", reviewed.GetProperty("profile").GetProperty("assignedSection").GetString());
    }
}
