using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Tests.AlphaSignups;

public sealed partial class AlphaSignupTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static string NewEmail() => $"tester-{Guid.NewGuid():N}@example.com";

    private static object ValidRequest(string email, string locale = "en") => new
    {
        email,
        nickname = "Link",
        platforms = new[] { "windows", "steam_deck" },
        recomps = "Zelda 64: Recompiled",
        locale,
        consent = true,
    };

    private static Task<HttpResponseMessage> SignUp(HttpClient client, object body) =>
        client.PostAsJsonAsync("/api/v1/alpha-signups", body, Ct);

    private string TokenFor(string email) =>
        TokenPattern().Match(factory.Emails.To(email)[^1].Text).Groups[1].Value;

    private async Task<string?> StatusOf(string email)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.AlphaSignups.Where(s => s.Email == email).Select(s => s.Status).SingleOrDefaultAsync(Ct);
    }

    [Fact]
    public async Task New_signup_is_accepted_stored_as_pending_and_emailed()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();

        using var response = await SignUp(client, ValidRequest(email));

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal("pending", await StatusOf(email));
        var message = Assert.Single(factory.Emails.To(email));
        Assert.Contains("https://recompachievements.test/alpha/confirm?token=", message.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Email_is_localized_and_links_to_the_locale()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();

        using var response = await SignUp(client, ValidRequest(email, "pt"));

        var message = Assert.Single(factory.Emails.To(email));
        Assert.StartsWith("Confirme sua inscrição", message.Subject, StringComparison.Ordinal);
        Assert.Contains("https://recompachievements.test/pt/alpha/confirm?token=", message.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Repeat_signup_with_different_case_keeps_one_row_and_throttles_the_email()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();

        using var first = await SignUp(client, ValidRequest(email));
        using var second = await SignUp(client, ValidRequest(email.ToUpperInvariant()));

        Assert.Equal(HttpStatusCode.Accepted, second.StatusCode);
        Assert.Single(factory.Emails.To(email));
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.AlphaSignups.CountAsync(s => s.Email == email, Ct));
    }

    [Fact]
    public async Task Confirming_marks_the_signup_confirmed_and_is_idempotent()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var signup = await SignUp(client, ValidRequest(email));

        using var confirm = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token = TokenFor(email) }, Ct);
        using var again = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token = TokenFor(email) }, Ct);

        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal("confirmed", await StatusOf(email));
    }

    [Fact]
    public async Task Signing_up_again_after_confirming_sends_no_email()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var signup = await SignUp(client, ValidRequest(email));
        using var confirm = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token = TokenFor(email) }, Ct);

        using var repeat = await SignUp(client, ValidRequest(email));

        Assert.Equal(HttpStatusCode.Accepted, repeat.StatusCode);
        Assert.Single(factory.Emails.To(email));
    }

    [Fact]
    public async Task Expired_link_returns_410()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var signup = await SignUp(client, ValidRequest(email));
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.AlphaSignups.Where(s => s.Email == email)
                .ExecuteUpdateAsync(set => set.SetProperty(s => s.ConfirmationExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct);
        }

        using var confirm = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token = TokenFor(email) }, Ct);

        Assert.Equal(HttpStatusCode.Gone, confirm.StatusCode);
        Assert.Equal("pending", await StatusOf(email));
    }

    [Theory]
    [InlineData("not-a-token")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task Unknown_or_malformed_token_returns_404(string token)
    {
        using var client = factory.CreateWebsiteClient();

        using var confirm = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token }, Ct);

        Assert.Equal(HttpStatusCode.NotFound, confirm.StatusCode);
    }

    private static readonly string[] Linux = ["linux"];
    private static readonly string[] Dreamcast = ["dreamcast"];

    public static TheoryData<string, string, object> InvalidRequests => new()
    {
        { "Email", "bad email", new { email = "not-an-email", nickname = "Link", platforms = Linux, locale = "en", consent = true } },
        { "Nickname", "nickname too short", new { email = "a@example.com", nickname = "L", platforms = Linux, locale = "en", consent = true } },
        { "Platforms", "no platform", new { email = "a@example.com", nickname = "Link", platforms = Array.Empty<string>(), locale = "en", consent = true } },
        { "Platforms", "unknown platform", new { email = "a@example.com", nickname = "Link", platforms = Dreamcast, locale = "en", consent = true } },
        { "Recomps", "recomps too long", new { email = "a@example.com", nickname = "Link", platforms = Linux, recomps = new string('x', 201), locale = "en", consent = true } },
        { "Locale", "unknown locale", new { email = "a@example.com", nickname = "Link", platforms = Linux, locale = "fr", consent = true } },
        { "Consent", "no consent", new { email = "a@example.com", nickname = "Link", platforms = Linux, locale = "en", consent = false } },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Invalid_request_returns_400_with_the_field_error(string field, string because, object body)
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await SignUp(client, body);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, because);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        var errors = problem.RootElement.GetProperty("errors");
        Assert.Contains(errors.EnumerateObject(), error => string.Equals(error.Name, field, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Invalid_requests_without_the_internal_key_get_401_not_validation_errors()
    {
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/v1/alpha-signups", new { email = "x" }, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.DoesNotContain("errors", await response.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Confirm_without_the_internal_key_is_rejected()
    {
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/v1/alpha-signups/confirm", new { token = "x" }, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Requests_without_the_internal_key_are_rejected()
    {
        using var client = factory.CreateClient();

        using var response = await SignUp(client, ValidRequest(NewEmail()));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Sixth_signup_from_the_same_visitor_within_10_minutes_is_rate_limited()
    {
        using var client = factory.CreateWebsiteClient("203.0.113.50");
        for (var i = 0; i < 5; i++)
        {
            using var accepted = await SignUp(client, ValidRequest(NewEmail()));
            Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
        }

        using var limited = await SignUp(client, ValidRequest(NewEmail()));

        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }

    [GeneratedRegex(@"token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenPattern();
}
