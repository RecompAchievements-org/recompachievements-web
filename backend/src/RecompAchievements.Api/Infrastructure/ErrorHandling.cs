namespace RecompAchievements.Api.Infrastructure;

internal static class ErrorHandling
{
    // Every error response is RFC 9457 ProblemDetails (application/problem+json) with a trace id.
    public static IServiceCollection AddErrorHandling(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
            context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);

        return services;
    }

    // Unhandled exceptions become 500 ProblemDetails; empty 4xx/5xx responses (e.g. 404) get a body.
    public static WebApplication UseErrorHandling(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        return app;
    }
}
