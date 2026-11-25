using System.ComponentModel.DataAnnotations;

namespace RecompAchievements.Api.Features.Accounts;

internal static class AccountRules
{
    // Letters, digits, "-" and "_"; 3 to 24 characters. Uniqueness ignores case.
    public const string UsernamePattern = "^[A-Za-z0-9_-]{3,24}$";
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128;
}

public sealed record RegisterRequest(
    [property: Required, EmailAddress, MaxLength(254)] string Email,
    [property: Required, StringLength(AccountRules.PasswordMaxLength, MinimumLength = AccountRules.PasswordMinLength)] string Password,
    [property: Required, RegularExpression(AccountRules.UsernamePattern)] string Username,
    [property: Required, AllowedValues("en", "es", "pt")] string Locale);

// Used by resend-confirmation and forgot-password: both always answer the same way.
public sealed record EmailRequest(
    [property: Required, EmailAddress, MaxLength(254)] string Email,
    [property: Required, AllowedValues("en", "es", "pt")] string Locale);

public sealed record TokenRequest([property: Required, MaxLength(64)] string Token);

// The password is only checked for being present; any wrong value gets the same 401 answer.
public sealed record SignInRequest(
    [property: Required, EmailAddress, MaxLength(254)] string Email,
    [property: Required, MaxLength(AccountRules.PasswordMaxLength)] string Password);

public sealed record ResetPasswordRequest(
    [property: Required, MaxLength(64)] string Token,
    [property: Required, StringLength(AccountRules.PasswordMaxLength, MinimumLength = AccountRules.PasswordMinLength)] string Password);

public sealed record OAuthCodeRequest(
    [property: Required, MaxLength(512)] string Code,
    [property: Required, StringLength(128, MinimumLength = 43)] string CodeVerifier);

public sealed record CompleteSignupRequest(
    [property: Required, MaxLength(2048)] string PendingToken,
    [property: Required, RegularExpression(AccountRules.UsernamePattern)] string Username,
    [property: Required, AllowedValues("en", "es", "pt")] string Locale);

public sealed record AcceptedResponse(string Status);

public sealed record StatusResponse(string Status);

public sealed record SessionResponse(string Token, DateTimeOffset ExpiresAt);

public sealed record UsernameAvailabilityResponse(bool Available);

public sealed record ProvidersResponse(string[] Providers);

public sealed record OAuthStartResponse(string AuthorizeUrl, string State, string CodeVerifier);

/** Result of a Discord/GitHub sign-in. "signed-in" carries a session. "pending" means no account
 *  has this platform ID yet: the website shows the welcome step with Email (the address the new
 *  account will use, or null when it will have none) and SuggestedUsername.
**/
public sealed record OAuthSignInResponse(
    string Status,
    SessionResponse? Session,
    string? PendingToken,
    string? Email,
    string? SuggestedUsername);

// After connecting a platform: EmailOffer is the platform's verified email, offered only to accounts without one.
public sealed record ConnectResponse(string Provider, string? EmailOffer);

// What anyone can see about a player; never add private fields.
// Role is "moderator" or "admin" for staff and null for players, so a player's role is never shown.
public sealed record PublicPlayerResponse(string Username, DateTimeOffset CreatedAt, DateOnly LastActiveOn, PlayerAvatarResponse? Avatar, string? Role);

public sealed record MeResponse(
    Guid Id,
    string Username,
    string? Email,
    bool EmailConfirmed,
    bool HasPassword,
    bool DiscordConnected,
    bool GithubConnected,
    bool CanCollectAchievements,
    bool IsAlphaTester,
    string Locale,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastActivityAt,
    string Role,
    bool IsMuted,
    DateTimeOffset? MutedUntil,
    PlayerAvatarResponse? Avatar);
