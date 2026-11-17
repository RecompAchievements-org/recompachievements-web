using System.Net;
using System.Text.Json;

namespace RecompAchievements.Api.Tests.Errors;

public sealed class ErrorResponseTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Unknown_route_returns_404_problem_details()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/does-not-exist", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(404, body.RootElement.GetProperty("status").GetInt32());
        Assert.True(body.RootElement.TryGetProperty("traceId", out _));
    }

    [Fact]
    public async Task Responses_include_security_headers_and_no_server_header()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health/live", TestContext.Current.CancellationToken);

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.False(response.Headers.Contains("Server"));
    }
}
