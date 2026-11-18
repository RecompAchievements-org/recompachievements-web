using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace RecompAchievements.Api.Infrastructure;

internal static class RateLimiting
{
    // Default budget per client IP; endpoints that need stricter limits add their own named policy.
    private const int PermitsPerMinute = 120;

    // Sign-ups per client IP within 10 minutes.
    public const string SignupsPolicy = "signups";
    private const int SignupsPerWindow = 5;

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(configuration.GetSection("RateLimiting"));
        services.AddRateLimiter(options =>
        {
            /** Two global limiters run on every request: a budget per client IP, and a site-wide cap
             *  on sign-ups across all visitors, so a flood from many IPs (each under its own limit)
             *  still can't create unlimited sign-ups or emails.
            **/
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        ClientAddress.Resolve(context),
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = PermitsPerMinute,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                        })),
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                    IsSignupEndpoint(context)
                        ? RateLimitPartition.GetFixedWindowLimiter(
                            "all-visitors",
                            _ => new FixedWindowRateLimiterOptions
                            {
                                PermitLimit = context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value.SignupsPerMinute,
                                Window = TimeSpan.FromMinutes(1),
                                QueueLimit = 0,
                            })
                        : RateLimitPartition.GetNoLimiter("other")));

            options.AddPolicy(SignupsPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ClientAddress.Resolve(context),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = SignupsPerWindow,
                        Window = TimeSpan.FromMinutes(10),
                        QueueLimit = 0,
                    }));

            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (rejection, cancellationToken) =>
            {
                var http = rejection.HttpContext;
                if (rejection.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    http.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }

                await http.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = http,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status429TooManyRequests,
                        Title = "Too many requests",
                        Detail = "Rate limit exceeded. Retry after the time given in the Retry-After header.",
                    },
                });
            };
        });

        return services;
    }

    private static bool IsSignupEndpoint(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == SignupsPolicy;
}

internal sealed class RateLimitingOptions
{
    // Sign-ups per minute across all visitors combined.
    public int SignupsPerMinute { get; set; } = 30;
}
