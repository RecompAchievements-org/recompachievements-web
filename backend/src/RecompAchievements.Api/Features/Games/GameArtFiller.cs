using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Features.Games;

/** Runs once after startup (the catalog is imported before the host starts): every game whose
 *  catalog file has no art, and that has no picked art yet, gets art from IGameArtSource. A failure
 *  only leaves that game with generated art until the next start; it never stops the API.
**/
internal sealed partial class GameArtFiller(IServiceScopeFactory scopes, ILogger<GameArtFiller> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var source = scope.ServiceProvider.GetRequiredService<IGameArtSource>();
        await FillMissingAsync(db, source, logger, stoppingToken);
    }

    public static async Task FillMissingAsync(AppDbContext db, IGameArtSource source, ILogger logger, CancellationToken cancellationToken)
    {
        // Few games, and art lives in a JSON column, so the filter runs in memory.
        var waiting = (await db.Games.AsTracking().ToListAsync(cancellationToken)).Where(game => game.Art is null).ToList();
        foreach (var game in waiting)
        {
            try
            {
                var art = await source.FindAsync(game.OriginalGame, game.SteamGridDbId, cancellationToken);
                if (art is null)
                {
                    LogNoArt(logger, game.Slug);
                    continue;
                }

                game.Art = art;
                await db.SaveChangesAsync(cancellationToken);
                LogPicked(logger, game.Slug);
            }
            /** Any failure (network, timeouts from the resilience pipeline, malformed replies) is logged
             *  and skipped: an unhandled exception in a background service would stop the whole API.
            **/
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                LogFailed(logger, exception, game.Slug);
            }
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Picked SteamGridDB art for {Slug}")]
    private static partial void LogPicked(ILogger logger, string slug);

    [LoggerMessage(Level = LogLevel.Information, Message = "No suitable SteamGridDB art found for {Slug}; it keeps generated art")]
    private static partial void LogNoArt(ILogger logger, string slug);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Picking SteamGridDB art for {Slug} failed; retrying on the next start")]
    private static partial void LogFailed(ILogger logger, Exception exception, string slug);
}
