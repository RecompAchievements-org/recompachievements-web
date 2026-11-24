using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;

namespace RecompAchievements.Api.Features.Accounts;

/** Sign-in and connecting through Discord and GitHub (authorization code with PKCE; the platform
 *  redirects to the website, whose server sends the code here). Rules:
 *  - Only the platform's unique ID finds an account. Emails never find, link, or merge accounts.
 *  - An unknown platform ID starts a new account (welcome step). It uses the platform's verified
 *    email unless a confirmed account already has it; then it's created without an email and must
 *    add and confirm one before it can collect achievements.
 *  - Connecting while signed in fills the platform ID if no other account has it. It never changes
 *    the account email; a verified platform email is only offered to accounts without one.
**/
internal static partial class OAuthEndpoints
{
    public static RouteGroupBuilder MapOAuthEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Accounts");

        group.MapGet("/providers", Providers)
            .WithSummary("Platforms offered for sign-in");
        group.MapPost("/oauth/{provider}/start", Start)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Authorize URL, state, and PKCE verifier for a platform sign-in");
        group.MapPost("/oauth/{provider}/complete", CompleteAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Finish a platform sign-in: a session, or a pending sign-up for the welcome step");
        group.MapPost("/oauth/complete-signup", CompleteSignupAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Create the account for a pending platform sign-up with the chosen username");
        group.MapPost("/oauth/{provider}/connect", ConnectAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Connect a platform to the signed-in account");
        group.MapDelete("/connections/{provider}", DisconnectAsync)
            .WithSummary("Disconnect a platform, if another way to sign in remains");

        return api;
    }

    private static Ok<ProvidersResponse> Providers(IEnumerable<IOAuthProvider> providers) =>
        TypedResults.Ok(new ProvidersResponse([.. providers.Select(p => p.Name).Order(StringComparer.Ordinal)]));

    private static Results<Ok<OAuthStartResponse>, ProblemHttpResult> Start(
        string provider,
        IEnumerable<IOAuthProvider> providers,
        AccountLinks links)
    {
        var platform = providers.FirstOrDefault(p => p.Name == provider);
        if (platform is null)
        {
            return AccountProblems.UnknownProvider();
        }

        var (state, verifier, challenge) = Pkce.Create();
        var url = platform.BuildAuthorizeUrl(state, challenge, RedirectUri(links, provider));
        return TypedResults.Ok(new OAuthStartResponse(url.ToString(), state, verifier));
    }

    private static async Task<Results<Ok<OAuthSignInResponse>, ProblemHttpResult>> CompleteAsync(
        string provider,
        OAuthCodeRequest request,
        IEnumerable<IOAuthProvider> providers,
        AppDbContext db,
        Sessions sessions,
        PendingSignupTokens pendingTokens,
        AccountLinks links,
        ILogger<IOAuthProvider> logger,
        CancellationToken cancellationToken)
    {
        var platform = providers.FirstOrDefault(p => p.Name == provider);
        if (platform is null)
        {
            return AccountProblems.UnknownProvider();
        }

        var (identity, problem) = await ExchangeAsync(platform, request, links, logger, cancellationToken);
        if (identity is null)
        {
            return problem!;
        }

        var linked = await WithPlatformId(db.Users, provider, identity.Id).Select(u => new { u.Id, u.IsEnabled }).FirstOrDefaultAsync(cancellationToken);
        if (linked is not null)
        {
            if (!linked.IsEnabled)
            {
                return AccountProblems.AccountDisabled();
            }

            var session = await sessions.CreateAsync(linked.Id, cancellationToken);
            return TypedResults.Ok(new OAuthSignInResponse("signed-in", session, null, null, null));
        }

        var email = await UsableEmailAsync(db, identity.VerifiedEmail, null, cancellationToken);
        var pendingToken = pendingTokens.Create(provider, identity.Id, email);
        return TypedResults.Ok(new OAuthSignInResponse("pending", null, pendingToken, email, AccountText.SuggestUsername(identity.Username)));
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult>> CompleteSignupAsync(
        CompleteSignupRequest request,
        AppDbContext db,
        Sessions sessions,
        PendingSignupTokens pendingTokens,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var pending = pendingTokens.Read(request.PendingToken);
        if (pending is null)
        {
            return AccountProblems.Create(StatusCodes.Status400BadRequest, "signup_expired", "The sign-up expired; sign in with the platform again");
        }

        var normalizedUsername = AccountText.NormalizeUsername(request.Username);
        if (AccountText.IsReserved(normalizedUsername)
            || await db.Users.AnyAsync(u => u.NormalizedUsername == normalizedUsername, cancellationToken))
        {
            return AccountProblems.UsernameTaken();
        }

        if (await WithPlatformId(db.Users, pending.Provider, pending.ProviderId).AnyAsync(cancellationToken))
        {
            return LinkedElsewhere(pending.Provider);
        }

        // Checked again: another account may have confirmed this email during the welcome step.
        var email = await UsableEmailAsync(db, pending.Email, null, cancellationToken);
        if (email is not null)
        {
            await db.Users.Where(u => u.Email == email && !u.EmailConfirmed && u.IsEnabled).ExecuteDeleteAsync(cancellationToken);
        }

        var now = time.GetUtcNow();
        var user = new User
        {
            Username = request.Username.Trim(),
            NormalizedUsername = normalizedUsername,
            Email = email,
            EmailConfirmed = email is not null,
            DiscordId = pending.Provider == OAuthProviderNames.Discord ? pending.ProviderId : null,
            GithubId = pending.Provider == OAuthProviderNames.Github ? pending.ProviderId : null,
            Locale = request.Locale,
            CreatedAt = now,
            LastActivityAt = now,
        };
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } unique)
        {
            // The welcome step was submitted twice at once, or someone took the username meanwhile.
            return unique.ConstraintName?.Contains("username", StringComparison.Ordinal) == true
                ? AccountProblems.UsernameTaken()
                : LinkedElsewhere(pending.Provider);
        }

        return TypedResults.Ok(await sessions.CreateAsync(user.Id, cancellationToken));
    }

    private static async Task<Results<Ok<ConnectResponse>, ProblemHttpResult>> ConnectAsync(
        string provider,
        OAuthCodeRequest request,
        HttpContext context,
        IEnumerable<IOAuthProvider> providers,
        AppDbContext db,
        Sessions sessions,
        AccountLinks links,
        ILogger<IOAuthProvider> logger,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var platform = providers.FirstOrDefault(p => p.Name == provider);
        if (platform is null)
        {
            return AccountProblems.UnknownProvider();
        }

        var (identity, problem) = await ExchangeAsync(platform, request, links, logger, cancellationToken);
        if (identity is null)
        {
            return problem!;
        }

        var owner = await WithPlatformId(db.Users, provider, identity.Id).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(cancellationToken);
        if (owner is { } ownerId && ownerId != session.UserId)
        {
            return LinkedElsewhere(provider);
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == session.UserId, cancellationToken);
        var current = provider == OAuthProviderNames.Discord ? user.DiscordId : user.GithubId;
        if (current is not null && current != identity.Id)
        {
            return AccountProblems.Create(
                StatusCodes.Status409Conflict,
                "platform_already_connected",
                $"This account is connected to another {OAuthProviderNames.DisplayName(provider)} account; disconnect it first");
        }

        if (current is null)
        {
            if (provider == OAuthProviderNames.Discord)
            {
                user.DiscordId = identity.Id;
            }
            else
            {
                user.GithubId = identity.Id;
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                return LinkedElsewhere(provider);
            }

            await links.SendNoticeAsync(user, AccountEmailKind.PlatformConnected, OAuthProviderNames.DisplayName(provider), cancellationToken);
        }

        // The account email is never replaced; a verified platform email is only offered when there is none.
        var offer = user.CanCollectAchievements
            ? null
            : await UsableEmailAsync(db, identity.VerifiedEmail, user.Id, cancellationToken);
        return TypedResults.Ok(new ConnectResponse(provider, offer));
    }

    // Allowed only if the account can still sign in: a confirmed email with a password, or the other platform.
    private static async Task<Results<NoContent, ProblemHttpResult>> DisconnectAsync(
        string provider,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        if (provider is not (OAuthProviderNames.Discord or OAuthProviderNames.Github))
        {
            return AccountProblems.UnknownProvider();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == session.UserId, cancellationToken);
        var other = provider == OAuthProviderNames.Discord ? user.GithubId : user.DiscordId;
        var canStillSignIn = (user.CanCollectAchievements && user.PasswordHash is not null) || other is not null;
        if (!canStillSignIn)
        {
            return AccountProblems.Create(
                StatusCodes.Status409Conflict,
                "last_sign_in_method",
                "Set a password or connect the other platform before disconnecting this one");
        }

        if (provider == OAuthProviderNames.Discord)
        {
            user.DiscordId = null;
        }
        else
        {
            user.GithubId = null;
        }

        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    // The website page the platform redirects back to; it must match the URL registered with the platform.
    private static Uri RedirectUri(AccountLinks links, string provider) => new(links.SiteBaseUrl, $"/auth/callback/{provider}");

    private static async Task<(ExternalIdentity? Identity, ProblemHttpResult? Problem)> ExchangeAsync(
        IOAuthProvider platform,
        OAuthCodeRequest request,
        AccountLinks links,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var identity = await platform.ExchangeAsync(request.Code, request.CodeVerifier, RedirectUri(links, platform.Name), cancellationToken);
            return identity is null
                ? (null, AccountProblems.Create(StatusCodes.Status400BadRequest, "platform_refused", "The platform didn't accept the sign-in; try again"))
                : (identity, null);
        }
        catch (Exception exception) when (exception is HttpRequestException or System.Text.Json.JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            LogPlatformFailed(logger, exception, platform.Name);
            return (null, AccountProblems.Create(StatusCodes.Status502BadGateway, "platform_unavailable", "The platform couldn't be reached; try again later"));
        }
    }

    private static IQueryable<User> WithPlatformId(IQueryable<User> users, string provider, string id) =>
        provider == OAuthProviderNames.Discord ? users.Where(u => u.DiscordId == id) : users.Where(u => u.GithubId == id);

    // The verified platform email, unless another account has it confirmed or is disabled while holding it.
    private static async Task<string?> UsableEmailAsync(AppDbContext db, string? verifiedEmail, Guid? exceptUserId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(verifiedEmail) || verifiedEmail.Length > 254)
        {
            return null;
        }

        var email = AccountText.NormalizeEmail(verifiedEmail);
        var taken = await db.Users.AnyAsync(u => u.Email == email && (u.EmailConfirmed || !u.IsEnabled) && u.Id != exceptUserId, cancellationToken);
        return taken ? null : email;
    }

    private static ProblemHttpResult LinkedElsewhere(string provider) =>
        AccountProblems.Create(
            StatusCodes.Status409Conflict,
            "platform_linked_elsewhere",
            $"That {OAuthProviderNames.DisplayName(provider)} account is connected to another RecompAchievements account");

    [LoggerMessage(Level = LogLevel.Warning, Message = "Sign-in with {Provider} failed to reach the platform")]
    private static partial void LogPlatformFailed(ILogger logger, Exception exception, string provider);
}
