using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Email;

namespace RecompAchievements.Api.Features.Accounts;

/** Emailed links (confirm an email, set a password) and notices. Issuing a link replaces the user's
 *  previous link of the same kind. Links are throttled per user and capped per day site-wide; when a
 *  link isn't sent the caller still answers normally, so responses never reveal anything.
**/
internal sealed partial class AccountLinks(
    AppDbContext db,
    IEmailSender emailSender,
    IOptions<EmailOptions> emailOptions,
    IConfiguration configuration,
    TimeProvider time,
    ILogger<AccountLinks> logger)
{
    public static readonly TimeSpan ConfirmEmailLifetime = TimeSpan.FromHours(24);
    public static readonly TimeSpan SetPasswordLifetime = TimeSpan.FromHours(1);
    private static readonly TimeSpan ResendInterval = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan EmailCapWindow = TimeSpan.FromHours(24);

    public Uri SiteBaseUrl => new(configuration["Site:BaseUrl"] ?? "https://recompachievements.org");

    // Sends a confirmation link for address (the account's own email, or one being added).
    public Task SendConfirmEmailAsync(User user, string address, CancellationToken cancellationToken) =>
        IssueAsync(user, UserTokenPurpose.ConfirmEmail, address, ConfirmEmailLifetime, AccountEmailKind.ConfirmEmail, "/confirm-email", cancellationToken);

    // Sends a set-password link to the account's confirmed email (kind: SetPassword or AlreadyRegistered).
    public Task SendSetPasswordAsync(User user, AccountEmailKind kind, CancellationToken cancellationToken) =>
        IssueAsync(user, UserTokenPurpose.SetPassword, null, SetPasswordLifetime, kind, "/reset-password", cancellationToken);

    // A notice without a link (password changed, platform connected), sent only to a confirmed email.
    public Task SendNoticeAsync(User user, AccountEmailKind kind, string? platform, CancellationToken cancellationToken) =>
        user.CanCollectAchievements
            ? TrySendAsync(AccountEmails.Build(kind, user.Email!, user.Username, user.Locale, platform: platform), user.Id, cancellationToken)
            : Task.CompletedTask;

    private async Task IssueAsync(
        User user,
        string purpose,
        string? address,
        TimeSpan lifetime,
        AccountEmailKind kind,
        string path,
        CancellationToken cancellationToken)
    {
        var to = address ?? user.Email;
        if (to is null)
        {
            return;
        }

        var now = time.GetUtcNow();
        var recentlySent = await db.UserTokens.AnyAsync(
            t => t.UserId == user.Id && t.Purpose == purpose && t.CreatedAt > now - ResendInterval, cancellationToken);
        if (recentlySent)
        {
            return;
        }

        var since = now - EmailCapWindow;
        var sentToday = await db.UserTokens.CountAsync(t => t.CreatedAt >= since, cancellationToken);
        if (sentToday >= emailOptions.Value.DailyAccountEmailLimit)
        {
            LogEmailCapReached(logger, emailOptions.Value.DailyAccountEmailLimit);
            return;
        }

        await db.UserTokens.Where(t => t.UserId == user.Id && t.Purpose == purpose).ExecuteDeleteAsync(cancellationToken);

        var (token, hash) = SecureToken.Create();
        db.UserTokens.Add(new UserToken
        {
            UserId = user.Id,
            Purpose = purpose,
            Email = address,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now + lifetime,
        });
        await db.SaveChangesAsync(cancellationToken);

        var link = AccountEmails.PageLink(SiteBaseUrl, user.Locale, path, token);
        await TrySendAsync(AccountEmails.Build(kind, to, user.Username, user.Locale, link), user.Id, cancellationToken);
    }

    private async Task TrySendAsync(EmailMessage message, Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            await emailSender.SendAsync(message, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            LogEmailFailed(logger, exception, userId);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Daily account email cap ({Limit}) reached; link not sent")]
    private static partial void LogEmailCapReached(ILogger logger, int limit);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Account email for user {UserId} could not be sent")]
    private static partial void LogEmailFailed(ILogger logger, Exception exception, Guid userId);
}

internal static class AccountText
{
    // Emails are compared case-insensitively; stored in one canonical form for the unique index.
#pragma warning disable CA1308 // Lower case is the conventional canonical form for emails and usernames.
    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public static string NormalizeUsername(string username) => username.Trim().ToLowerInvariant();
#pragma warning restore CA1308

    // Names that could pass for the project or its staff, or that are pages under /account.
    private static readonly HashSet<string> ReservedUsernames =
    [
        "admin", "administrator", "root", "system", "staff", "support", "moderator", "mod",
        "official", "security", "contact", "help", "recompachievements", "recomp", "api", "null",
        "settings", "messages", "notifications", "edit", "new",
    ];

    public static bool IsReserved(string normalizedUsername) => ReservedUsernames.Contains(normalizedUsername);

    /** A username suggestion from a platform name: allowed characters only, 3–24 long. The welcome
     *  step checks availability; this is only a starting value.
    **/
    public static string SuggestUsername(string platformName)
    {
        var cleaned = new string([.. platformName.Where(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_')]);
        if (cleaned.Length > 24)
        {
            cleaned = cleaned[..24];
        }

        return cleaned.Length >= 3 ? cleaned : cleaned + "player";
    }
}

// Machine-readable error codes the website maps to localized messages.
internal static class AccountProblems
{
    public static ProblemHttpResult Create(int status, string code, string title) =>
        TypedResults.Problem(statusCode: status, title: title, extensions: new Dictionary<string, object?> { ["code"] = code });

    public static ProblemHttpResult NotSignedIn() => Create(StatusCodes.Status401Unauthorized, "not_signed_in", "Not signed in");

    public static ProblemHttpResult InvalidCredentials() =>
        Create(StatusCodes.Status401Unauthorized, "invalid_credentials", "Email or password is incorrect");

    public static ProblemHttpResult UsernameTaken() => Create(StatusCodes.Status409Conflict, "username_taken", "Username is taken");

    public static ProblemHttpResult EmailInUse() =>
        Create(StatusCodes.Status409Conflict, "email_in_use", "That email is used by another account");

    // Only reachable by someone who proved they own the platform account, so it reveals nothing to others.
    public static ProblemHttpResult AccountDisabled() =>
        Create(StatusCodes.Status403Forbidden, "account_disabled", "This account is disabled");

    public static ProblemHttpResult LinkInvalid() => Create(StatusCodes.Status404NotFound, "link_invalid", "Unknown or used link");

    public static ProblemHttpResult LinkExpired() => Create(StatusCodes.Status410Gone, "link_expired", "Link expired");

    public static ProblemHttpResult UnknownProvider() => Create(StatusCodes.Status404NotFound, "unknown_provider", "Unknown sign-in platform");
}
