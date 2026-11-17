namespace RecompAchievements.Api.Infrastructure;

internal static class Security
{
    // Small request bodies only: the API receives JSON, never uploads.
    private const long MaxRequestBodyBytes = 1_048_576;

    public static WebApplicationBuilder ConfigureServerLimits(this WebApplicationBuilder builder)
    {
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.AddServerHeader = false;
            options.Limits.MaxRequestBodySize = MaxRequestBodyBytes;
        });

        return builder;
    }

    // Baseline response headers; HTTPS and HSTS are enforced by the hosting proxy.
    public static WebApplication UseSecurityHeaders(this WebApplication app)
    {
        app.Use(async (context, next) =>
        {
            context.Response.Headers.XContentTypeOptions = "nosniff";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            await next(context);
        });

        return app;
    }
}
