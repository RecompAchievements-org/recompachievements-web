using System.Net;

namespace RecompAchievements.Api.Tests.Health;

// The readiness check queries the database, so it is rate-limited; liveness touches nothing and isn't.
public sealed class HealthRateLimitTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const int PerIpLimitPerMinute = 120;

    [Fact]
    public async Task Readiness_check_is_rate_limited_per_client()
    {
        using var client = factory.CreateClient();
        var statuses = new List<HttpStatusCode>();

        for (var i = 0; i <= PerIpLimitPerMinute; i++)
        {
            using var response = await client.GetAsync("/health/ready", TestContext.Current.CancellationToken);
            statuses.Add(response.StatusCode);
        }

        Assert.All(statuses.Take(PerIpLimitPerMinute), status => Assert.Equal(HttpStatusCode.OK, status));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
    }

    [Fact]
    public async Task Liveness_check_is_never_rate_limited()
    {
        using var client = factory.CreateClient();

        for (var i = 0; i <= PerIpLimitPerMinute + 30; i++)
        {
            using var response = await client.GetAsync("/health/live", TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
