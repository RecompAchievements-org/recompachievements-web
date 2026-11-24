using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Accounts;

/** Email + password accounts, sessions, and the signed-in account. Rules that keep accounts safe:
 *  - Sign-in needs a confirmed email AND a password that was set. Every failure (unknown email,
 *    wrong or missing password, unconfirmed email, locked account) gets the same 401 answer and
 *    runs a password hash, so neither the message nor the timing tells them apart.
 *  - A password is only ever set through a link emailed to the confirmed address (forgot-password),
 *    which is also how accounts created through Discord/GitHub get their first password.
 *  - Register, resend, and forgot-password always answer 202, so they don't reveal who has an account.
 *  - A disabled account can't sign in, use a session or an emailed link, or receive new links, and
 *    its email stays reserved so it can't be registered again.
**/
internal static class AccountEndpoints
{
    private const int MaxFailedSignIns = 10;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public static RouteGroupBuilder MapAccountEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Accounts");

        group.MapPost("/register", RegisterAsync)
            .RequireRateLimiting(RateLimiting.EmailSendingPolicy)
            .WithSummary("Create an email + password account (sends a confirmation email)");
        group.MapPost("/confirm-email", ConfirmEmailAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Confirm an email with the token from the email");
        group.MapPost("/resend-confirmation", ResendConfirmationAsync)
            .RequireRateLimiting(RateLimiting.EmailSendingPolicy)
            .WithSummary("Send the confirmation email again for an unconfirmed account");
        group.MapPost("/sign-in", SignInAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Sign in with email and password; returns a session token");
        group.MapPost("/sign-out", SignOutAsync)
            .WithSummary("End the current session");
        group.MapGet("/me", MeAsync)
            .WithSummary("The signed-in account");
        group.MapPost("/forgot-password", ForgotPasswordAsync)
            .RequireRateLimiting(RateLimiting.EmailSendingPolicy)
            .WithSummary("Email a link to set or reset the password");
        group.MapPost("/reset-password", ResetPasswordAsync)
            .RequireRateLimiting(RateLimiting.SignInPolicy)
            .WithSummary("Set a new password with the token from the email; signs out every session");
        group.MapGet("/usernames/available", UsernameAvailableAsync)
            .WithSummary("Whether a username can be chosen");
        group.MapPost("/email/add", AddEmailAsync)
            .RequireRateLimiting(RateLimiting.EmailSendingPolicy)
            .WithSummary("Add an email to a signed-in account without one (sends a confirmation email)");

        return api;
    }

    private static async Task<Results<Accepted<AcceptedResponse>, ProblemHttpResult>> RegisterAsync(
        RegisterRequest request,
        AppDbContext db,
        AccountLinks links,
        IPasswordHasher<User> hasher,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var accepted = TypedResults.Accepted((string?)null, new AcceptedResponse("accepted"));
        var email = AccountText.NormalizeEmail(request.Email);
        var normalizedUsername = AccountText.NormalizeUsername(request.Username);

        var existing = await db.Users.AsTracking().FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        /** The username is checked before anything about the email, so a taken username answers 409
         *  whether or not the email has an account. An unconfirmed registration of the same email
         *  may reuse its own username.
        **/
        var usernameTaken = AccountText.IsReserved(normalizedUsername)
            || await db.Users.AnyAsync(u => u.NormalizedUsername == normalizedUsername && (existing == null || u.Id != existing.Id), cancellationToken);
        if (usernameTaken)
        {
            return AccountProblems.UsernameTaken();
        }

        if (existing is { IsEnabled: false })
        {
            return accepted;
        }

        if (existing is { EmailConfirmed: true })
        {
            // The owner gets a "you already have an account" email with a set-password link.
            await links.SendSetPasswordAsync(existing, AccountEmailKind.AlreadyRegistered, cancellationToken);
            return accepted;
        }

        var user = existing;
        if (user is null)
        {
            var now = time.GetUtcNow();
            user = new User
            {
                Username = request.Username.Trim(),
                NormalizedUsername = normalizedUsername,
                Email = email,
                Locale = request.Locale,
                CreatedAt = now,
                LastActivityAt = now,
            };
            db.Users.Add(user);
        }
        else
        {
            // Registered again before confirming: the latest details win and a fresh link is sent.
            user.Username = request.Username.Trim();
            user.NormalizedUsername = normalizedUsername;
            user.Locale = request.Locale;
        }

        user.PasswordHash = hasher.HashPassword(user, request.Password);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } unique)
        {
            // A simultaneous request took the username or the email; for the email, that request sends the link.
            return unique.ConstraintName?.Contains("username", StringComparison.Ordinal) == true
                ? AccountProblems.UsernameTaken()
                : accepted;
        }

        await links.SendConfirmEmailAsync(user, email, cancellationToken);
        return accepted;
    }

    /** Confirms an email: the account's own (after registering) or one being added. If another
     *  account confirmed the same address first, this one is refused; an unconfirmed registration
     *  holding the address is removed, since it was never usable.
    **/
    private static async Task<Results<Ok<StatusResponse>, ProblemHttpResult>> ConfirmEmailAsync(
        TokenRequest request,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var token = await FindTokenAsync(db, request.Token, UserTokenPurpose.ConfirmEmail, cancellationToken);
        if (token is null)
        {
            return AccountProblems.LinkInvalid();
        }

        if (token.ExpiresAt <= time.GetUtcNow())
        {
            await db.UserTokens.Where(t => t.Id == token.Id).ExecuteDeleteAsync(cancellationToken);
            return AccountProblems.LinkExpired();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == token.UserId, cancellationToken);
        if (!user.IsEnabled)
        {
            return AccountProblems.LinkInvalid();
        }

        var email = token.Email!;
        if (user.EmailConfirmed && user.Email != email)
        {
            return AccountProblems.EmailInUse();
        }

        var holder = await db.Users.AsTracking().FirstOrDefaultAsync(u => u.Email == email && u.Id != user.Id, cancellationToken);
        if (holder is { EmailConfirmed: true } or { IsEnabled: false })
        {
            return AccountProblems.EmailInUse();
        }

        if (holder is not null)
        {
            db.Users.Remove(holder);
            await db.SaveChangesAsync(cancellationToken);
        }

        user.Email = email;
        user.EmailConfirmed = true;
        await db.SaveChangesAsync(cancellationToken);
        await db.UserTokens.Where(t => t.UserId == user.Id && t.Purpose == UserTokenPurpose.ConfirmEmail).ExecuteDeleteAsync(cancellationToken);

        return TypedResults.Ok(new StatusResponse("confirmed"));
    }

    private static async Task<Accepted<AcceptedResponse>> ResendConfirmationAsync(
        EmailRequest request,
        AppDbContext db,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        var email = AccountText.NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && !u.EmailConfirmed && u.IsEnabled, cancellationToken);
        if (user is not null)
        {
            await links.SendConfirmEmailAsync(user, email, cancellationToken);
        }

        return TypedResults.Accepted((string?)null, new AcceptedResponse("accepted"));
    }

    private static async Task<Results<Ok<SessionResponse>, ProblemHttpResult>> SignInAsync(
        SignInRequest request,
        AppDbContext db,
        Sessions sessions,
        IPasswordHasher<User> hasher,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var email = AccountText.NormalizeEmail(request.Email);
        var user = await db.Users.AsTracking().FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        var now = time.GetUtcNow();

        // No account, locked, or no password: hash anyway so the answer takes as long as a real check.
        if (user is null || user.LockedUntil > now || user.PasswordHash is null)
        {
            DummyPassword.Verify(hasher, request.Password);
            // A password-less account counts failures too, exactly like a wrong password would.
            if (user is not null && !(user.LockedUntil > now))
            {
                await RecordFailureAsync(db, user, now, cancellationToken);
            }

            return AccountProblems.InvalidCredentials();
        }

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            await RecordFailureAsync(db, user, now, cancellationToken);
            return AccountProblems.InvalidCredentials();
        }

        if (!user.EmailConfirmed || !user.IsEnabled)
        {
            return AccountProblems.InvalidCredentials();
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, request.Password);
        }

        user.FailedSignInCount = 0;
        user.LockedUntil = null;
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(await sessions.CreateAsync(user.Id, cancellationToken));
    }

    // Too many wrong passwords lock email sign-in for a while; the lock looks like any other failure.
    private static async Task RecordFailureAsync(AppDbContext db, User user, DateTimeOffset now, CancellationToken cancellationToken)
    {
        user.FailedSignInCount++;
        if (user.FailedSignInCount >= MaxFailedSignIns)
        {
            user.FailedSignInCount = 0;
            user.LockedUntil = now + LockoutDuration;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<NoContent> SignOutAsync(HttpContext context, Sessions sessions, CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is { } session)
        {
            await sessions.RevokeAsync(session.SessionId, cancellationToken);
        }

        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<MeResponse>, ProblemHttpResult>> MeAsync(
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        TimeProvider time,
        IOptions<AlphaPhaseOptions> alphaPhase,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var user = await db.Users.SingleAsync(u => u.Id == session.UserId, cancellationToken);

        // Alpha testers aren't stored on the account: every account created during the alpha phase is one.
        var isAlphaTester = alphaPhase.Value.Includes(user.CreatedAt);

        return TypedResults.Ok(new MeResponse(
            user.Id,
            user.Username,
            user.Email,
            user.EmailConfirmed,
            user.PasswordHash is not null,
            user.DiscordId is not null,
            user.GithubId is not null,
            user.CanCollectAchievements,
            isAlphaTester,
            user.Locale,
            user.CreatedAt,
            user.LastActivityAt,
            user.Role,
            user.IsMutedAt(time.GetUtcNow()),
            user.MutedUntil,
            AvatarImages.Urls(media, user.AvatarKey)));
    }

    // Sends a set-password link only to a confirmed email; the answer is the same either way.
    private static async Task<Accepted<AcceptedResponse>> ForgotPasswordAsync(
        EmailRequest request,
        AppDbContext db,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        var email = AccountText.NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.EmailConfirmed && u.IsEnabled, cancellationToken);
        if (user is not null)
        {
            await links.SendSetPasswordAsync(user, AccountEmailKind.SetPassword, cancellationToken);
        }

        return TypedResults.Accepted((string?)null, new AcceptedResponse("accepted"));
    }

    private static async Task<Results<Ok<StatusResponse>, ProblemHttpResult>> ResetPasswordAsync(
        ResetPasswordRequest request,
        AppDbContext db,
        Sessions sessions,
        AccountLinks links,
        IPasswordHasher<User> hasher,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var token = await FindTokenAsync(db, request.Token, UserTokenPurpose.SetPassword, cancellationToken);
        if (token is null)
        {
            return AccountProblems.LinkInvalid();
        }

        if (token.ExpiresAt <= time.GetUtcNow())
        {
            await db.UserTokens.Where(t => t.Id == token.Id).ExecuteDeleteAsync(cancellationToken);
            return AccountProblems.LinkExpired();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == token.UserId, cancellationToken);
        if (!user.IsEnabled)
        {
            return AccountProblems.LinkInvalid();
        }

        user.PasswordHash = hasher.HashPassword(user, request.Password);
        user.FailedSignInCount = 0;
        user.LockedUntil = null;
        await db.SaveChangesAsync(cancellationToken);

        await db.UserTokens.Where(t => t.UserId == user.Id && t.Purpose == UserTokenPurpose.SetPassword).ExecuteDeleteAsync(cancellationToken);
        await sessions.RevokeAllAsync(user.Id, cancellationToken);
        await links.SendNoticeAsync(user, AccountEmailKind.PasswordChanged, null, cancellationToken);

        return TypedResults.Ok(new StatusResponse("password-set"));
    }

    private static async Task<Ok<UsernameAvailabilityResponse>> UsernameAvailableAsync(
        string? username,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var valid = username is not null && System.Text.RegularExpressions.Regex.IsMatch(username, AccountRules.UsernamePattern);
        if (!valid)
        {
            return TypedResults.Ok(new UsernameAvailabilityResponse(false));
        }

        var normalized = AccountText.NormalizeUsername(username!);
        var available = !AccountText.IsReserved(normalized)
            && !await db.Users.AnyAsync(u => u.NormalizedUsername == normalized, cancellationToken);
        return TypedResults.Ok(new UsernameAvailabilityResponse(available));
    }

    /** Adds an email to a signed-in account that has none confirmed (e.g. created through Discord or
     *  GitHub without one). It becomes the account email only after the emailed link is followed.
    **/
    private static async Task<Results<Accepted<AcceptedResponse>, ProblemHttpResult>> AddEmailAsync(
        EmailRequest request,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == session.UserId, cancellationToken);
        if (user.EmailConfirmed)
        {
            return AccountProblems.Create(StatusCodes.Status409Conflict, "email_already_set", "This account already has an email");
        }

        var email = AccountText.NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(u => u.Email == email && (u.EmailConfirmed || !u.IsEnabled) && u.Id != user.Id, cancellationToken))
        {
            return AccountProblems.EmailInUse();
        }

        user.Locale = request.Locale;
        await db.SaveChangesAsync(cancellationToken);
        await links.SendConfirmEmailAsync(user, email, cancellationToken);
        return TypedResults.Accepted((string?)null, new AcceptedResponse("accepted"));
    }

    private static async Task<UserToken?> FindTokenAsync(AppDbContext db, string token, string purpose, CancellationToken cancellationToken)
    {
        var hash = SecureToken.TryHash(token);
        return hash is null
            ? null
            : await db.UserTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.Purpose == purpose, cancellationToken);
    }
}

// A fixed hash to verify against when there is no real one, so every sign-in failure costs the same.
internal static class DummyPassword
{
    private static readonly User Placeholder = new()
    {
        Username = "placeholder",
        NormalizedUsername = "placeholder",
        Locale = "en",
        LastActivityAt = DateTimeOffset.UnixEpoch,
    };
    private static string? _hash;

    public static void Verify(IPasswordHasher<User> hasher, string password)
    {
        _hash ??= hasher.HashPassword(Placeholder, Guid.NewGuid().ToString());
        hasher.VerifyHashedPassword(Placeholder, _hash, password);
    }
}
