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

    /** /health/live answers while the process runs (no dependencies checked) and is exempt from
     *  rate limiting. /health/ready also queries the database (503 when unreachable), so it keeps
     *  the normal per-IP limit: the host's probe calls it far less often, but a flood can't use it
     *  to load the database.
    **/
    public static WebApplication MapHealthEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health/live", new() { Predicate = _ => false })
            .DisableRateLimiting();
        app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains(ReadyTag) });

        return app;
    }
}
