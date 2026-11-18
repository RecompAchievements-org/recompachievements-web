using System.Collections.Concurrent;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Infrastructure.Email;
using Testcontainers.PostgreSql;

namespace RecompAchievements.Api.Tests;

/** Runs the API in memory against a throwaway PostgreSQL 17 container (requires Docker), with
 *  migrations and the game catalog applied at startup and emails captured instead of sent. The
 *  "Testing" environment keeps Development-only behaviour (API docs) off.
**/
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string InternalKey = "test-internal-key";

    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public CapturingEmailSender Emails { get; } = new();

    public async ValueTask InitializeAsync() => await _database.StartAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", _database.GetConnectionString());
        builder.UseSetting("Database:ApplyMigrationsOnStartup", "true");
        builder.UseSetting("Catalog:ImportOnStartup", "true");
        builder.UseSetting("InternalApi:Key", InternalKey);
        builder.UseSetting("Site:BaseUrl", "https://recompachievements.test");
        // High site-wide sign-up limit so ordinary tests never hit it; abuse tests lower it.
        builder.UseSetting("RateLimiting:SignupsPerMinute", "10000");
        builder.ConfigureTestServices(services => services.AddSingleton<IEmailSender>(Emails));
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }
}

public static class WebsiteClientExtensions
{
    /** A client that calls like the website does: with the internal key and a visitor IP. Each
     *  client gets its own random IP so rate limits don't leak between tests. Works on factories
     *  derived with WithWebHostBuilder (same database, adjusted settings).
    **/
    public static HttpClient CreateWebsiteClient(this WebApplicationFactory<Program> factory, string? clientIp = null)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Internal-Key", ApiFactory.InternalKey);
        client.DefaultRequestHeaders.Add("X-Client-IP", clientIp ?? $"10.{Random.Shared.Next(256)}.{Random.Shared.Next(256)}.{Random.Shared.Next(1, 255)}");
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return client;
    }
}

// Collects emails in memory so tests can read confirmation links.
public sealed class CapturingEmailSender : IEmailSender
{
    public ConcurrentQueue<EmailMessage> Sent { get; } = new();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Sent.Enqueue(message);
        return Task.CompletedTask;
    }

    public IReadOnlyList<EmailMessage> To(string address) =>
        [.. Sent.Where(message => string.Equals(message.ToAddress, address, StringComparison.OrdinalIgnoreCase))];
}

// Same API, pointed at a port where no database listens, to test failure paths.
public sealed class UnreachableDatabaseApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting(
            "ConnectionStrings:Database",
            "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2");
    }
}
