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

    public static RouteGroupBuilder RequireInternalKey(this RouteGroupBuilder group)
    {
        group.AddEndpointFilter(async (context, next) => IsValid(context.HttpContext)
            ? await next(context)
            : TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Missing or invalid internal key"));
        return group;
    }
}
