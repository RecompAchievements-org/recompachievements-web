using System.Buffers.Text;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

namespace RecompAchievements.Api.Features.Accounts;

/** Who a Discord or GitHub user is. VerifiedEmail is set only when the platform says the address is
 *  verified; an unverified address is never passed on.
**/
internal sealed record ExternalIdentity(string Id, string Username, string? VerifiedEmail);

internal interface IOAuthProvider
{
    // "discord" or "github": the route value and the provider name the website shows.
    string Name { get; }

    Uri BuildAuthorizeUrl(string state, string codeChallenge, Uri redirectUri);

    // Exchanges the authorization code; null when the platform refuses it (expired, reused, forged).
    Task<ExternalIdentity?> ExchangeAsync(string code, string codeVerifier, Uri redirectUri, CancellationToken cancellationToken);
}

internal sealed class OAuthClientOptions
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
}

internal static class OAuthProviderNames
{
    public const string Discord = "discord";
    public const string Github = "github";

    public static string DisplayName(string provider) => provider == Github ? "GitHub" : "Discord";
}

internal static class Pkce
{
    // A random state and PKCE verifier, and the S256 challenge sent to the platform.
    public static (string State, string Verifier, string Challenge) Create()
    {
        var state = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var verifier = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var challenge = Base64Url.EncodeToString(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        return (state, verifier, challenge);
    }
}

internal sealed class DiscordOAuthProvider(HttpClient http, IOptionsMonitor<OAuthClientOptions> options) : IOAuthProvider
{
    private OAuthClientOptions Client => options.Get(OAuthProviderNames.Discord);

    public string Name => OAuthProviderNames.Discord;

    public Uri BuildAuthorizeUrl(string state, string codeChallenge, Uri redirectUri) =>
        new("https://discord.com/oauth2/authorize" + QueryString.Create(new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = Client.ClientId,
            ["scope"] = "identify email",
            ["state"] = state,
            ["redirect_uri"] = redirectUri.ToString(),
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
        }).ToUriComponent());

    public async Task<ExternalIdentity?> ExchangeAsync(string code, string codeVerifier, Uri redirectUri, CancellationToken cancellationToken)
    {
        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://discord.com/api/oauth2/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = redirectUri.ToString(),
                ["code_verifier"] = codeVerifier,
            }),
        };
        tokenRequest.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Client.ClientId}:{Client.ClientSecret}")));

        using var tokenResponse = await http.SendAsync(tokenRequest, cancellationToken);
        if (!tokenResponse.IsSuccessStatusCode)
        {
            return null;
        }

        var token = await tokenResponse.Content.ReadFromJsonAsync(OAuthJsonContext.Default.OAuthTokenResponse, cancellationToken);
        if (string.IsNullOrEmpty(token?.AccessToken))
        {
            return null;
        }

        using var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/users/@me");
        userRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        using var userResponse = await http.SendAsync(userRequest, cancellationToken);
        userResponse.EnsureSuccessStatusCode();

        var user = await userResponse.Content.ReadFromJsonAsync(OAuthJsonContext.Default.DiscordUser, cancellationToken)
            ?? throw new HttpRequestException("Discord returned no user.");

        return new ExternalIdentity(
            user.Id,
            user.Username,
            user.Verified == true && !string.IsNullOrWhiteSpace(user.Email) ? user.Email : null);
    }
}

internal sealed class GithubOAuthProvider(HttpClient http, IOptionsMonitor<OAuthClientOptions> options) : IOAuthProvider
{
    private OAuthClientOptions Client => options.Get(OAuthProviderNames.Github);

    public string Name => OAuthProviderNames.Github;

    public Uri BuildAuthorizeUrl(string state, string codeChallenge, Uri redirectUri) =>
        new("https://github.com/login/oauth/authorize" + QueryString.Create(new Dictionary<string, string?>
        {
            ["client_id"] = Client.ClientId,
            ["scope"] = "user:email",
            ["state"] = state,
            ["redirect_uri"] = redirectUri.ToString(),
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
        }).ToUriComponent());

    public async Task<ExternalIdentity?> ExchangeAsync(string code, string codeVerifier, Uri redirectUri, CancellationToken cancellationToken)
    {
        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = Client.ClientId,
                ["client_secret"] = Client.ClientSecret,
                ["code"] = code,
                ["redirect_uri"] = redirectUri.ToString(),
                ["code_verifier"] = codeVerifier,
            }),
        };

        // GitHub answers 200 with an "error" field for refused codes, so a missing token means refused.
        using var tokenResponse = await http.SendAsync(tokenRequest, cancellationToken);
        if (!tokenResponse.IsSuccessStatusCode)
        {
            return null;
        }

        var token = await tokenResponse.Content.ReadFromJsonAsync(OAuthJsonContext.Default.OAuthTokenResponse, cancellationToken);
        if (string.IsNullOrEmpty(token?.AccessToken))
        {
            return null;
        }

        var user = await GetAsync(token.AccessToken, "https://api.github.com/user", OAuthJsonContext.Default.GithubUser, cancellationToken);
        var emails = await GetAsync(token.AccessToken, "https://api.github.com/user/emails", OAuthJsonContext.Default.GithubEmailArray, cancellationToken);
        var primary = emails.FirstOrDefault(email => email.Primary && email.Verified);

        return new ExternalIdentity(user.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), user.Login, primary?.Email);
    }

    private async Task<T> GetAsync<T>(string accessToken, string url, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> type, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync(type, cancellationToken)
            ?? throw new HttpRequestException($"GitHub returned nothing for {url}.");
    }
}

internal sealed record OAuthTokenResponse([property: JsonPropertyName("access_token")] string? AccessToken);

internal sealed record DiscordUser(string Id, string Username, string? Email, bool? Verified);

internal sealed record GithubUser(long Id, string Login);

internal sealed record GithubEmail(string Email, bool Primary, bool Verified);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(OAuthTokenResponse))]
[JsonSerializable(typeof(DiscordUser))]
[JsonSerializable(typeof(GithubUser))]
[JsonSerializable(typeof(GithubEmail[]))]
internal sealed partial class OAuthJsonContext : JsonSerializerContext;

internal static class OAuthSetup
{
    /** Registers Discord and GitHub sign-in when their client ID and secret are configured
     *  ("Discord:ClientId", "Discord:ClientSecret", "GitHub:ClientId", "GitHub:ClientSecret"). A
     *  platform without settings is simply not offered. Code exchanges are never retried: each
     *  authorization code works once.
    **/
    public static IServiceCollection AddOAuthProviders(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<OAuthClientOptions>(OAuthProviderNames.Discord, configuration.GetSection("Discord"));
        services.Configure<OAuthClientOptions>(OAuthProviderNames.Github, configuration.GetSection("GitHub"));

        if (IsConfigured(configuration.GetSection("Discord")))
        {
            services.AddHttpClient<DiscordOAuthProvider>(ConfigureClient).AddStandardResilienceHandler(NoUnsafeRetries);
            services.AddTransient<IOAuthProvider>(provider => provider.GetRequiredService<DiscordOAuthProvider>());
        }

        if (IsConfigured(configuration.GetSection("GitHub")))
        {
            services.AddHttpClient<GithubOAuthProvider>(ConfigureClient).AddStandardResilienceHandler(NoUnsafeRetries);
            services.AddTransient<IOAuthProvider>(provider => provider.GetRequiredService<GithubOAuthProvider>());
        }

        return services;
    }

    private static bool IsConfigured(IConfigurationSection section) =>
        !string.IsNullOrWhiteSpace(section["ClientId"]) && !string.IsNullOrWhiteSpace(section["ClientSecret"]);

    private static void ConfigureClient(HttpClient client)
    {
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        // GitHub's API rejects requests without a User-Agent.
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("RecompAchievements", "1.0"));
    }

    private static void NoUnsafeRetries(HttpStandardResilienceOptions options) => options.Retry.DisableForUnsafeHttpMethods();
}
