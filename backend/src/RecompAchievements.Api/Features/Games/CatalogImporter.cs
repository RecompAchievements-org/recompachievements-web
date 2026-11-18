using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Features.Games;

internal static partial class CatalogImporter
{
    /** Imports the catalog at startup when "Catalog:ImportOnStartup" is true (Development, tests,
     *  and the hosted instance). Runs after migrations; an invalid catalog stops startup.
    **/
    public static async Task ImportCatalogIfEnabledAsync(this WebApplication app)
    {
        if (!app.Configuration.GetValue<bool>("Catalog:ImportOnStartup"))
        {
            return;
        }

        var games = Catalog.Load(app.Configuration["Catalog:Directory"] ?? Catalog.DefaultDirectory);
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var time = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        await ImportAsync(db, games, time, CancellationToken.None);
        LogImported(app.Logger, games.Count);
    }

    /** Makes the database match the catalog in one transaction: games and achievements are matched
     *  by slug and apiKeyName and updated in place (so their ids stay stable), new ones are added,
     *  and ones no longer in the catalog are deleted. Nothing is written if validation fails.
    **/
    public static async Task ImportAsync(AppDbContext db, IReadOnlyList<CatalogGame> catalog, TimeProvider time, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var errors = Catalog.Validate(catalog, DateOnly.FromDateTime(now.UtcDateTime));
        if (errors.Count > 0)
        {
            throw new InvalidOperationException($"The game catalog is invalid:{Environment.NewLine}- {string.Join($"{Environment.NewLine}- ", errors)}");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var existing = await db.Games.AsTracking()
            .Include(game => game.Sets).ThenInclude(set => set.Achievements)
            .ToDictionaryAsync(game => game.Slug, cancellationToken);

        foreach (var entry in catalog)
        {
            if (!existing.Remove(entry.Slug, out var game))
            {
                game = new Game
                {
                    Slug = entry.Slug,
                    Title = entry.Title,
                    OriginalPlatform = entry.OriginalPlatform,
                    OriginalGame = entry.OriginalGame,
                    Platforms = entry.Platforms,
                    Summary = entry.Summary,
                    CreatedAt = now,
                };
                db.Games.Add(game);
            }

            game.Title = entry.Title;
            game.OriginalPlatform = entry.OriginalPlatform;
            game.OriginalGame = entry.OriginalGame;
            game.Platforms = [.. entry.Platforms];
            game.Summary = entry.Summary;
            game.RepoUrl = entry.RepoUrl;
            game.License = entry.License;
            game.DisplayOrder = entry.DisplayOrder;
            game.Featured = entry.Featured;
            game.LatestVersion = entry.LatestVersion;
            game.ReleasedAt = entry.ReleasedAt;
            game.HeroImage = entry.HeroImage;
            game.UpdatedAt = now;

            var coreSet = game.Sets.SingleOrDefault(set => set.Kind == AchievementSetKind.Core);
            if (coreSet is null)
            {
                coreSet = new AchievementSet { Status = AchievementSetStatus.Preview };
                game.Sets.Add(coreSet);
            }

            SyncAchievements(coreSet, entry.CoreSet.Achievements);
        }

        // Games left over are no longer in the catalog.
        db.Games.RemoveRange(existing.Values);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static void SyncAchievements(AchievementSet set, CatalogAchievement[] entries)
    {
        var byKey = set.Achievements.ToDictionary(achievement => achievement.ApiKeyName);
        for (var index = 0; index < entries.Length; index++)
        {
            var entry = entries[index];
            if (!byKey.Remove(entry.ApiKeyName, out var achievement))
            {
                achievement = new Achievement
                {
                    ApiKeyName = entry.ApiKeyName,
                    Title = entry.Title,
                    Description = entry.Description,
                    RarityTier = entry.RarityTier,
                    Kind = entry.Kind,
                };
                set.Achievements.Add(achievement);
            }

            achievement.Title = entry.Title;
            achievement.Description = entry.Description;
            achievement.Points = entry.Points;
            achievement.RarityTier = entry.RarityTier;
            achievement.Kind = entry.Kind;
            achievement.ProgressionStep = entry.ProgressionStep;
            achievement.DisplayOrder = index + 1;
        }

        foreach (var removed in byKey.Values)
        {
            set.Achievements.Remove(removed);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Game catalog imported: {Count} games")]
    private static partial void LogImported(ILogger logger, int count);
}
