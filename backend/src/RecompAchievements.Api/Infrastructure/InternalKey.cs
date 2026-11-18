using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace RecompAchievements.Api.Infrastructure;

internal sealed class InternalApiOptions
{
    public string Key { get; set; } = string.Empty;
}

/** Website-only endpoints require the shared "X-Internal-Key" header (set by the Next.js server,
 *  never sent to browsers). The comparison is constant time; an unset key rejects every request.
**/
internal static class InternalKey
{
    public const string HeaderName = "X-Internal-Key";

    public static IServiceCollection AddInternalKey(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<InternalApiOptions>(configuration.GetSection("InternalApi"));
        return services;
    }

    public static bool IsValid(HttpContext context)
    {
        var expected = context.RequestServices.GetRequiredService<IOptions<InternalApiOptions>>().Value.Key;
        var provided = context.Request.Headers[HeaderName].ToString();

        return expected.Length > 0
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(provided), Encoding.UTF8.GetBytes(expected));
    }

    /** Rejects requests under the given path prefix without a valid key, before routing reaches
     *  the endpoint. Running as middleware (not an endpoint filter) means unauthenticated callers
     *  are turned away before the request body is read or validated.
    **/
    public static WebApplication UseInternalKey(this WebApplication app, PathString pathPrefix)
    {
        app.Use(async (context, next) =>
        {
            if (!context.Request.Path.StartsWithSegments(pathPrefix) || IsValid(context))
            {
                await next(context);
                return;
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = { Status = StatusCodes.Status401Unauthorized, Title = "Missing or invalid internal key" },
            });
        });

        return app;
    }
}
