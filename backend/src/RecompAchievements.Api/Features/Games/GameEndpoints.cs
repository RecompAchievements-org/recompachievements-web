using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Features.Games;

internal static class GameEndpoints
{
    public static RouteGroupBuilder MapGameEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/games").WithTags("Games");

        group.MapGet("/", ListAsync).WithSummary("List games with their core-set totals");
        group.MapGet("/{slug}", GetAsync).WithSummary("Get a game and its core-set achievements");

        return api;
    }

    private static async Task<Ok<GameSummaryResponse[]>> ListAsync(
        AppDbContext db,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en")
    {
        var games = await db.Games
            .OrderBy(game => game.DisplayOrder).ThenBy(game => game.Title)
            .Select(game => new
            {
                game.Slug,
                game.Title,
                game.OriginalPlatform,
                game.Platforms,
                game.Summary,
                game.Featured,
                game.LatestVersion,
                game.ReleasedAt,
                game.HeroImage,
                CoreSet = game.Sets
                    .Where(set => set.Kind == AchievementSetKind.Core)
                    .Select(set => new { set.Status, Count = set.Achievements.Count, Points = set.Achievements.Sum(a => a.Points) })
                    .First(),
            })
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(games.Select(game => new GameSummaryResponse(
            game.Slug,
            game.Title,
            game.OriginalPlatform,
            game.Platforms,
            game.Summary.For(lang),
            game.CoreSet.Status,
            game.CoreSet.Count,
            game.CoreSet.Points,
            game.Featured,
            game.LatestVersion,
            game.ReleasedAt,
            GameImageResponse.From(game.Slug, game.HeroImage, lang))).ToArray());
    }

    private static async Task<Results<Ok<GameDetailResponse>, ProblemHttpResult>> GetAsync(
        [MaxLength(64)] string slug,
        AppDbContext db,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en")
    {
        var game = await db.Games
            .Where(game => game.Slug == slug)
            .Select(game => new
            {
                game.Slug,
                game.Title,
                game.OriginalPlatform,
                game.Platforms,
                game.Summary,
                game.RepoUrl,
                game.LatestVersion,
                game.ReleasedAt,
                game.HeroImage,
                CoreSet = game.Sets
                    .Where(set => set.Kind == AchievementSetKind.Core)
                    .Select(set => new
                    {
                        set.Status,
                        Achievements = set.Achievements
                            .OrderBy(achievement => achievement.DisplayOrder)
                            .Select(achievement => new
                            {
                                achievement.ApiKeyName,
                                achievement.Title,
                                achievement.Description,
                                achievement.Points,
                                achievement.RarityTier,
                                achievement.Kind,
                                achievement.ProgressionStep,
                            })
                            .ToList(),
                    })
                    .First(),
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (game is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Game not found");
        }

        // Text is stored in every language; pick the requested one after loading.
        var achievements = game.CoreSet.Achievements
            .Select(achievement => new AchievementResponse(
                achievement.ApiKeyName,
                achievement.Title.For(lang),
                achievement.Description.For(lang),
                achievement.Points,
                achievement.RarityTier,
                achievement.Kind,
                achievement.ProgressionStep))
            .ToArray();

        return TypedResults.Ok(new GameDetailResponse(
            game.Slug,
            game.Title,
            game.OriginalPlatform,
            game.Platforms,
            game.Summary.For(lang),
            game.RepoUrl,
            game.LatestVersion,
            game.ReleasedAt,
            GameImageResponse.From(game.Slug, game.HeroImage, lang),
            new AchievementSetResponse(game.CoreSet.Status, achievements.Length, achievements.Sum(achievement => achievement.Points), achievements)));
    }
}
