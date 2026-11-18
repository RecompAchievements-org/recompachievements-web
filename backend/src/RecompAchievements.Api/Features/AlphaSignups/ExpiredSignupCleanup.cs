using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Features.AlphaSignups;

/** Deletes pending sign-ups whose confirmation link expired, every hour. This keeps the promise in
 *  the confirmation email and privacy notice: unconfirmed data isn't kept after the link expires.
**/
internal sealed partial class ExpiredSignupCleanup(
    IServiceScopeFactory scopes,
    TimeProvider time,
    ILogger<ExpiredSignupCleanup> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

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
                var deleted = await db.AlphaSignups
                    .Where(s => s.Status == AlphaSignupStatus.Pending && s.ConfirmationExpiresAt < now)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deleted > 0)
                {
                    LogDeleted(logger, deleted);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                LogFailed(logger, exception);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted {Count} expired, unconfirmed alpha sign-ups")]
    private static partial void LogDeleted(ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Expired alpha sign-up cleanup failed; retrying next hour")]
    private static partial void LogFailed(ILogger logger, Exception exception);
}
