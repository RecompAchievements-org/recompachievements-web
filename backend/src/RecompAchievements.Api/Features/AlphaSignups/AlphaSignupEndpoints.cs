using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Email;

namespace RecompAchievements.Api.Features.AlphaSignups;

internal static partial class AlphaSignupEndpoints
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(7);
    private static readonly TimeSpan ResendInterval = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan EmailCapWindow = TimeSpan.FromHours(24);

    public static RouteGroupBuilder MapAlphaSignupEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/alpha-signups").WithTags("Alpha sign-ups");

        group.MapPost("/", CreateAsync)
            .RequireRateLimiting(RateLimiting.EmailSendingPolicy)
            .WithSummary("Sign up for the alpha (sends a confirmation email)");
        group.MapPost("/confirm", ConfirmAsync)
            .WithSummary("Confirm an alpha sign-up with the token from the email");

        return api;
    }

    /** Always answers 202 with the same body, whether the email is new, pending, or confirmed, so
     *  the endpoint can't be used to find out who signed up. New and pending sign-ups get a
     *  confirmation email; pending ones at most once every 10 minutes.
    **/
    private static async Task<Accepted<AlphaSignupAcceptedResponse>> CreateAsync(
        CreateAlphaSignupRequest request,
        AppDbContext db,
        IEmailSender emailSender,
        IOptions<EmailOptions> emailOptions,
        TimeProvider time,
        IConfiguration configuration,
        ILogger<AlphaSignup> logger,
        CancellationToken cancellationToken)
    {
        var accepted = TypedResults.Accepted((string?)null, new AlphaSignupAcceptedResponse("accepted"));
        var email = NormalizeEmail(request.Email);
        var now = time.GetUtcNow();

        var signup = await db.AlphaSignups.AsTracking().FirstOrDefaultAsync(s => s.Email == email, cancellationToken);
        if (signup?.Status == AlphaSignupStatus.Confirmed
            || (signup?.ConfirmationSentAt is { } lastSent && now - lastSent < ResendInterval))
        {
            return accepted;
        }

        var (token, hash) = SecureToken.Create();
        if (signup is null)
        {
            signup = new AlphaSignup
            {
                Email = email,
                Nickname = request.Nickname.Trim(),
                Platforms = [.. request.Platforms.Distinct()],
                Recomps = string.IsNullOrWhiteSpace(request.Recomps) ? null : request.Recomps.Trim(),
                Locale = request.Locale,
                ConfirmationTokenHash = hash,
                ConsentedAt = now,
                CreatedAt = now,
            };
            db.AlphaSignups.Add(signup);
        }
        else
        {
            // Pending sign-up submitted again: keep the latest answers and issue a fresh link.
            signup.Nickname = request.Nickname.Trim();
            signup.Platforms = [.. request.Platforms.Distinct()];
            signup.Recomps = string.IsNullOrWhiteSpace(request.Recomps) ? null : request.Recomps.Trim();
            signup.Locale = request.Locale;
            signup.ConfirmationTokenHash = hash;
            signup.ConsentedAt = now;
        }

        signup.ConfirmationExpiresAt = now + TokenLifetime;

        /** Daily email cap: if a flood of sign-ups (e.g. many victims' addresses) has used today's
         *  budget, the sign-up is still saved but no email is sent; ConfirmationSentAt stays empty,
         *  so submitting again later sends the email without waiting for the resend interval.
        **/
        var since = now - EmailCapWindow;
        var sentRecently = await db.AlphaSignups.CountAsync(s => s.ConfirmationSentAt >= since, cancellationToken);
        var withinCap = sentRecently < emailOptions.Value.DailyConfirmationLimit;
        signup.ConfirmationSentAt = withinCap ? now : null;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // A simultaneous request for the same email won the race; it sends the email.
            return accepted;
        }

        if (!withinCap)
        {
            LogEmailCapReached(logger, emailOptions.Value.DailyConfirmationLimit);
            return accepted;
        }

        var siteBaseUrl = new Uri(configuration["Site:BaseUrl"] ?? "https://recompachievements.org");
        try
        {
            await emailSender.SendAsync(ConfirmationEmail.Build(signup, token, siteBaseUrl), cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            // The sign-up is saved; submitting the form again after 10 minutes resends the email.
            LogEmailFailed(logger, exception, signup.Id);
        }

        return accepted;
    }

    private static async Task<Results<Ok<AlphaSignupConfirmedResponse>, ProblemHttpResult>> ConfirmAsync(
        ConfirmAlphaSignupRequest request,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var hash = SecureToken.TryHash(request.Token);
        var signup = hash is null
            ? null
            : await db.AlphaSignups.AsTracking().FirstOrDefaultAsync(s => s.ConfirmationTokenHash == hash, cancellationToken);

        if (signup is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Unknown confirmation link");
        }

        if (signup.Status == AlphaSignupStatus.Confirmed)
        {
            return TypedResults.Ok(new AlphaSignupConfirmedResponse(AlphaSignupStatus.Confirmed));
        }

        var now = time.GetUtcNow();
        if (signup.ConfirmationExpiresAt < now)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status410Gone, title: "Confirmation link expired");
        }

        signup.Status = AlphaSignupStatus.Confirmed;
        signup.ConfirmedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(new AlphaSignupConfirmedResponse(AlphaSignupStatus.Confirmed));
    }

    // Emails are compared case-insensitively; stored in one canonical form for the unique index.
#pragma warning disable CA1308 // Lower case is the conventional canonical form for email addresses.
    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
#pragma warning restore CA1308

    [LoggerMessage(Level = LogLevel.Warning, Message = "Daily confirmation email cap ({Limit}) reached; sign-up saved without sending an email")]
    private static partial void LogEmailCapReached(ILogger logger, int limit);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Confirmation email for alpha sign-up {SignupId} could not be sent")]
    private static partial void LogEmailFailed(ILogger logger, Exception exception, Guid signupId);
}
