using System.Net;

namespace RecompAchievements.Api.Infrastructure;

/** The visitor's IP for rate limiting. Requests from the website carry it in "X-Client-IP"; that
 *  header is trusted only together with a valid internal key, so nobody else can choose their own
 *  rate-limit bucket. Everyone else is identified by the connection (after forwarded headers).
**/
internal static class ClientAddress
{
    public const string HeaderName = "X-Client-IP";

    public static string Resolve(HttpContext context)
    {
        var forwarded = context.Request.Headers[HeaderName].ToString();
        if (forwarded.Length > 0 && IPAddress.TryParse(forwarded, out var address) && InternalKey.IsValid(context))
        {
            return address.ToString();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
