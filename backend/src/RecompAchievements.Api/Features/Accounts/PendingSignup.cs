using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using RecompAchievements.Api.Infrastructure;

namespace RecompAchievements.Api.Features.Accounts;

/** A Discord/GitHub sign-in whose platform ID has no account yet, waiting for the welcome step
 *  (username). Email is the verified platform email the account will use, or null when it will be
 *  created without one.
**/
internal sealed record PendingSignup(string Provider, string ProviderId, string? Email, long ExpiresAt);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(PendingSignup))]
internal sealed partial class PendingSignupJsonContext : JsonSerializerContext;

/** Pending sign-ups are never stored: they travel as a short-lived token signed with HMAC-SHA256,
 *  so the website can hold it during the welcome step but nobody can forge or alter it. The key is
 *  derived from the internal API key with HKDF, for this purpose only.
**/
internal sealed class PendingSignupTokens(IOptions<InternalApiOptions> internalApi, TimeProvider time)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    public string Create(string provider, string providerId, string? email)
    {
        var pending = new PendingSignup(provider, providerId, email, (time.GetUtcNow() + Lifetime).ToUnixTimeSeconds());
        var payload = JsonSerializer.SerializeToUtf8Bytes(pending, PendingSignupJsonContext.Default.PendingSignup);
        return $"{Base64Url.EncodeToString(payload)}.{Base64Url.EncodeToString(Sign(payload))}";
    }

    // Null when the token is malformed, altered, or expired.
    public PendingSignup? Read(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 2 || !Base64Url.IsValid(parts[0]) || !Base64Url.IsValid(parts[1]))
        {
            return null;
        }

        var payload = Base64Url.DecodeFromChars(parts[0]);
        var signature = Base64Url.DecodeFromChars(parts[1]);
        if (!CryptographicOperations.FixedTimeEquals(signature, Sign(payload)))
        {
            return null;
        }

        var pending = JsonSerializer.Deserialize(payload, PendingSignupJsonContext.Default.PendingSignup);
        return pending is not null && pending.ExpiresAt > time.GetUtcNow().ToUnixTimeSeconds() ? pending : null;
    }

    private byte[] Sign(byte[] payload)
    {
        var secret = internalApi.Value.Key;
        if (secret.Length == 0)
        {
            throw new InvalidOperationException("InternalApi:Key is required to sign pending sign-ups.");
        }

        var key = HKDF.DeriveKey(HashAlgorithmName.SHA256, Encoding.UTF8.GetBytes(secret), 32, info: "pending-signup"u8.ToArray());
        return HMACSHA256.HashData(key, payload);
    }
}
