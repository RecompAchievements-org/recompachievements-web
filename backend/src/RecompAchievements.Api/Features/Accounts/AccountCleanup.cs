using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Moderation;

namespace RecompAchievements.Api.Features.Accounts;

/** Every hour, deletes expired sessions and emailed links, and email + password registrations that
 *  were never confirmed once their confirmation link has expired (they could never sign in). This
 *  keeps the privacy notice's promise that unconfirmed sign-ups aren't kept. Sessions and links of
 *  disabled accounts are deleted too, so enabling an account again doesn't bring them back; the
 *  disabled account itself is kept, so its email stays reserved. Moderation evidence is erased once
 *  its retention period ends, except records under a legal hold.
**/
internal sealed partial class AccountCleanup(
    IServiceScopeFactory scopes,
    TimeProvider time,
    ILogger<AccountCleanup> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan EvidenceRetention = TimeSpan.FromDays(90);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval, time);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = time.GetUtcNow();

                await db.UserSessions.Where(s => s.ExpiresAt <= now).ExecuteDeleteAsync(stoppingToken);
                await db.UserTokens.Where(t => t.ExpiresAt <= now).ExecuteDeleteAsync(stoppingToken);
                await db.UserSessions.Where(s => db.Users.Any(u => u.Id == s.UserId && !u.IsEnabled)).ExecuteDeleteAsync(stoppingToken);
                await db.UserTokens.Where(t => db.Users.Any(u => u.Id == t.UserId && !u.IsEnabled)).ExecuteDeleteAsync(stoppingToken);
                var unconfirmed = await db.Users
                    .Where(u => u.IsEnabled && u.Email != null && !u.EmailConfirmed && !db.UserTokens.Any(t => t.UserId == u.Id))
                    .ExecuteDeleteAsync(stoppingToken);

                var evidenceCutoff = now - EvidenceRetention;
                await db.ModerationActions
                    .Where(a => a.Evidence != null && a.CreatedAt <= evidenceCutoff && a.Action != ModerationActionKinds.LegalHold)
                    .ExecuteUpdateAsync(set => set.SetProperty(a => a.Evidence, (string?)null), stoppingToken);
                await db.ModerationReports
                    .Where(r => r.Snapshot != null && r.Status != ReportStatuses.Open && r.ResolvedAt <= evidenceCutoff)
                    .ExecuteUpdateAsync(set => set.SetProperty(r => r.Snapshot, (string?)null), stoppingToken);

                if (unconfirmed > 0)
                {
                    LogDeleted(logger, unconfirmed);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                LogFailed(logger, exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted {Count} unconfirmed registrations whose link expired")]
    private static partial void LogDeleted(ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Account cleanup failed; retrying next hour")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
