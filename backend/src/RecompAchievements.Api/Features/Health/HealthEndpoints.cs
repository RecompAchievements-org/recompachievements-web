using Microsoft.Extensions.Diagnostics.HealthChecks;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Features.Health;

internal static class HealthEndpoints
{
    private const string ReadyTag = "ready";

    public static IServiceCollection AddHealth(this IServiceCollection services)
    {
        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database", tags: [ReadyTag]);
        return services;
    }

    /** /health/live answers while the process runs (no dependencies checked);
     *  /health/ready also checks the database and returns 503 when it is unreachable.
     *  Both are exempt from rate limiting so the host's probes never get throttled.
    **/
    public static WebApplication MapHealthEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health/live", new() { Predicate = _ => false })
            .DisableRateLimiting();
        app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains(ReadyTag) })
            .DisableRateLimiting();

        return app;
    }
}
