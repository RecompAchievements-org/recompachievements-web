using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure.Email;

namespace RecompAchievements.Api.Features.AlphaSignups;

internal sealed class AlphaMigrationOptions
{
    // Off by default; turned on for the release that migrates the earlier alpha list.
    public bool Enabled { get; set; }

    // Logs what a run would do without creating accounts or sending email.
    public bool DryRun { get; set; }
}

// What one run did (or, in a dry run, would do).
internal sealed record AlphaMigrationResult(int Created, int AlreadyHadAccount, int RenamedUsernames, int InvitesSent, int InvitesWaiting, int Failed);

/** Turns confirmed sign-ups from the earlier alpha list into player accounts and welcomes them by
 *  email, in each sign-up's language. While enabled it runs at startup and then every hour, so it
 *  picks up where it stopped after a crash, an email failure, or a full daily email budget, and does
 *  nothing once everyone is migrated. Each step is recorded on the sign-up, so it never creates an
 *  account or sends a welcome twice:
 *  1. A sign-up whose email already has an account (any state) is only marked as handled; that
 *     person is an alpha tester through the email match and gets no email.
 *  2. Otherwise an account is created with the sign-up's email (already confirmed by the list's
 *     double opt-in), its language, no password, and a username from its nickname, adjusted to the
 *     username rules and numbered when taken. The account and the mark are saved together.
 *  3. Each created account gets one welcome email with its username and a set-password link. The
 *     job uses only part of the site's daily account-email budget, so players' own links still go out.
**/
internal sealed partial class AlphaSignupMigration(
    IServiceScopeFactory scopes,
    IOptions<AlphaMigrationOptions> options,
    TimeProvider time,
    ILogger<AlphaSignupMigration> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            return;
        }

        using var timer = new PeriodicTimer(Interval, time);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await RunAsync(scope.ServiceProvider, options.Value.DryRun, stoppingToken);
            }
            /** Any failure is logged and retried next hour: an unhandled exception in a background
             *  service would stop the whole API.
            **/
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                LogRunFailed(logger, exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public static async Task<AlphaMigrationResult> RunAsync(IServiceProvider services, bool dryRun, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var links = services.GetRequiredService<AccountLinks>();
        var emailOptions = services.GetRequiredService<IOptions<EmailOptions>>().Value;
        var time = services.GetRequiredService<TimeProvider>();
        var logger = services.GetRequiredService<ILogger<AlphaSignupMigration>>();

        int created = 0, alreadyHadAccount = 0, renamed = 0, sent = 0, waiting = 0, failed = 0;
        var claimedInDryRun = new HashSet<string>();

        var signups = await db.AlphaSignups.AsTracking()
            .Where(s => s.Status == AlphaSignupStatus.Confirmed && s.MigratedAt == null)
            .OrderBy(s => s.ConfirmedAt)
            .ToListAsync(cancellationToken);

        foreach (var signup in signups)
        {
            var now = time.GetUtcNow();
            if (await db.Users.AnyAsync(u => u.Email == signup.Email, cancellationToken))
            {
                alreadyHadAccount++;
                if (!dryRun)
                {
                    signup.MigratedAt = now;
                    await db.SaveChangesAsync(cancellationToken);
                }

                continue;
            }

            var username = await PickUsernameAsync(db, signup.Nickname, claimedInDryRun, cancellationToken);
            if (username != signup.Nickname)
            {
                renamed++;
            }

            if (dryRun)
            {
                claimedInDryRun.Add(AccountText.NormalizeUsername(username));
                created++;
                waiting++;
                continue;
            }

            var user = new User
            {
                Username = username,
                NormalizedUsername = AccountText.NormalizeUsername(username),
                Email = signup.Email,
                EmailConfirmed = true,
                Locale = signup.Locale,
                CreatedAt = now,
                LastActivityAt = now,
            };
            db.Users.Add(user);
            signup.MigratedAt = now;
            signup.MigratedUserId = user.Id;
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                created++;
            }
            // Someone took the email or username in the meantime: undo this one and retry next run.
            catch (DbUpdateException exception)
            {
                db.Entry(user).State = EntityState.Detached;
                await db.Entry(signup).ReloadAsync(cancellationToken);
                failed++;
                LogCreateFailed(logger, exception, signup.Id);
            }
        }

        var invites = await db.AlphaSignups.AsTracking()
            .Where(s => s.MigratedUserId != null && s.InviteSentAt == null)
            .OrderBy(s => s.MigratedAt)
            .ToListAsync(cancellationToken);

        var budget = emailOptions.DailyAccountEmailLimit / 2;
        foreach (var signup in invites)
        {
            var user = await db.Users.SingleAsync(u => u.Id == signup.MigratedUserId, cancellationToken);
            if (!user.CanCollectAchievements)
            {
                continue;
            }

            var since = time.GetUtcNow() - TimeSpan.FromHours(24);
            if (dryRun || await db.UserTokens.CountAsync(t => t.CreatedAt >= since, cancellationToken) >= budget)
            {
                waiting++;
                continue;
            }

            if (await links.SendAlphaWelcomeAsync(user, cancellationToken))
            {
                signup.InviteSentAt = time.GetUtcNow();
                await db.SaveChangesAsync(cancellationToken);
                sent++;
            }
            else
            {
                waiting++;
            }
        }

        var result = new AlphaMigrationResult(created, alreadyHadAccount, renamed, sent, waiting, failed);
        LogRun(logger, dryRun ? "Dry run" : "Run", result.Created, result.AlreadyHadAccount, result.RenamedUsernames, result.InvitesSent, result.InvitesWaiting, result.Failed);
        return result;
    }

    /** The nickname adjusted to the username rules (allowed characters, 3–24 long), numbered from 2
     *  when it's reserved or taken (by an account, or earlier in the same dry run).
    **/
    private static async Task<string> PickUsernameAsync(AppDbContext db, string nickname, HashSet<string> claimed, CancellationToken cancellationToken)
    {
        var stem = AccountText.SuggestUsername(nickname);
        var candidate = stem;
        for (var number = 2; ; number++)
        {
            var normalized = AccountText.NormalizeUsername(candidate);
            var free = !AccountText.IsReserved(normalized)
                && !claimed.Contains(normalized)
                && !await db.Users.AnyAsync(u => u.NormalizedUsername == normalized, cancellationToken);
            if (free)
            {
                return candidate;
            }

            var suffix = number.ToString(System.Globalization.CultureInfo.InvariantCulture);
            candidate = stem[..Math.Min(stem.Length, 24 - suffix.Length)] + suffix;
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Alpha list migration {Mode}: {Created} accounts created, {Existing} already had one, {Renamed} usernames adjusted, {Sent} welcomes sent, {Waiting} welcomes waiting, {Failed} failed")]
    private static partial void LogRun(ILogger logger, string mode, int created, int existing, int renamed, int sent, int waiting, int failed);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Creating the account for alpha sign-up {SignupId} failed; retrying next run")]
    private static partial void LogCreateFailed(ILogger logger, Exception exception, Guid signupId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Alpha list migration run failed; retrying next hour")]
    private static partial void LogRunFailed(ILogger logger, Exception exception);
}
