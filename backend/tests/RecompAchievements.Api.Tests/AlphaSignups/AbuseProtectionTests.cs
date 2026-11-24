using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Tests.AlphaSignups;

internal static class SignupRequests
{
    public static string NewEmail() => $"tester-{Guid.NewGuid():N}@example.com";

    public static object Valid(string email) => new
    {
        email,
        nickname = "Link",
        platforms = new[] { "windows" },
        locale = "en",
        consent = true,
    };
}

// Daily email cap: a flood of sign-ups for different addresses can't exhaust the email quota.
public sealed class EmailCapTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Signups_beyond_the_daily_email_cap_are_saved_without_sending_an_email()
    {
        using var capped = factory.WithWebHostBuilder(builder => builder.UseSetting("Email:DailyConfirmationLimit", "2"));
        var emails = Enumerable.Range(0, 3).Select(_ => SignupRequests.NewEmail()).ToArray();

        foreach (var email in emails)
        {
            using var client = capped.CreateWebsiteClient();
            using var response = await client.PostAsJsonAsync("/api/v1/alpha-signups", SignupRequests.Valid(email), TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        }

        Assert.Single(factory.Emails.To(emails[0]));
        Assert.Single(factory.Emails.To(emails[1]));
        Assert.Empty(factory.Emails.To(emails[2]));

        await using var scope = capped.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var unsent = await db.AlphaSignups.SingleAsync(s => s.Email == emails[2], TestContext.Current.CancellationToken);
        Assert.Equal("pending", unsent.Status);
        Assert.Null(unsent.ConfirmationSentAt);
    }
}

// Site-wide sign-up limit: many visitors (each under their own limit) still can't flood sign-ups.
public sealed class SignupFloodTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Signups_from_many_visitors_beyond_the_site_wide_limit_are_rate_limited()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:EmailRequestsPerMinute", "3"));

        var statuses = new List<HttpStatusCode>();
        for (var visitor = 1; visitor <= 4; visitor++)
        {
            using var client = limited.CreateWebsiteClient($"198.51.100.{visitor}");
            using var response = await client.PostAsJsonAsync("/api/v1/alpha-signups", SignupRequests.Valid(SignupRequests.NewEmail()), TestContext.Current.CancellationToken);
            statuses.Add(response.StatusCode);
        }

        Assert.Equal([HttpStatusCode.Accepted, HttpStatusCode.Accepted, HttpStatusCode.Accepted, HttpStatusCode.TooManyRequests], statuses);
    }
}
