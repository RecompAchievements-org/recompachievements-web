using Microsoft.AspNetCore.HttpOverrides;

namespace RecompAchievements.Api.Infrastructure;

internal static class ProxySupport
{
    /** Reads the client IP and scheme from X-Forwarded-* headers set by the hosting proxy, so rate
     *  limiting sees real clients. Only enable "ForwardedHeaders:TrustAllProxies" where the API is
     *  reachable exclusively through that proxy; otherwise clients could spoof their IP.
    **/
    public static IServiceCollection AddProxySupport(this IServiceCollection services, IConfiguration configuration)
    {
        var trustAllProxies = configuration.GetValue<bool>("ForwardedHeaders:TrustAllProxies");

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            if (trustAllProxies)
            {
                options.KnownIPNetworks.Clear();
                options.KnownProxies.Clear();
            }
        });

        return services;
    }
}
