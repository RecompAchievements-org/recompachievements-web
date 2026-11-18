using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace RecompAchievements.Api.Features.Games;

/** The curated game catalog: one JSON file per game in Catalog/Games/, reviewed through pull
 *  requests and imported at startup. It is the source of game data until the developer portal
 *  exists; achievement text in it must be original (never copied from official trophy lists).
**/
public sealed record CatalogGame(
    string Slug,
    string Title,
    string OriginalPlatform,
    string OriginalGame,
    string[] Platforms,
    string? RepoUrl,
    int DisplayOrder,
    LocalizedText Summary,
    CatalogSet CoreSet,
    bool Featured = false,
    string? LatestVersion = null,
    DateOnly? ReleasedAt = null,
    GameImage? HeroImage = null,
    string? License = null);

public sealed record CatalogSet(CatalogAchievement[] Achievements);

public sealed record CatalogAchievement(
    string ApiKeyName,
    LocalizedText Title,
    LocalizedText Description,
    int Points,
    string RarityTier,
    string Kind,
    int? ProgressionStep);

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    ReadCommentHandling = JsonCommentHandling.Skip,
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow)]
[JsonSerializable(typeof(CatalogGame))]
internal sealed partial class CatalogJsonContext : JsonSerializerContext;

internal static partial class Catalog
{
    public static string DefaultDirectory => Path.Combine(AppContext.BaseDirectory, "Catalog", "Games");

    public static IReadOnlyList<CatalogGame> Load(string directory)
    {
        var games = new List<CatalogGame>();
        foreach (var path in Directory.EnumerateFiles(directory, "*.json").Order(StringComparer.Ordinal))
        {
            try
            {
                var game = JsonSerializer.Deserialize(File.ReadAllText(path), CatalogJsonContext.Default.CatalogGame)
                    ?? throw new InvalidOperationException("The file is empty.");
                games.Add(game);
            }
            catch (JsonException exception)
            {
                throw new InvalidOperationException($"Catalog file '{Path.GetFileName(path)}' is not valid JSON: {exception.Message}", exception);
            }
        }

        return games;
    }

    /** Returns every problem found, so one run reports them all. The rarity caps follow
     *  docs/achievement-system.md: at most 10% Legendary, 20% Epic, and 30% Rare per set. Release
     *  dates can't be later than today.
    **/
    public static IReadOnlyList<string> Validate(IReadOnlyList<CatalogGame> games, DateOnly today)
    {
        var errors = new List<string>();
        foreach (var duplicate in games.GroupBy(game => game.Slug).Where(group => group.Count() > 1))
        {
            errors.Add($"Slug '{duplicate.Key}' is used by more than one game.");
        }

        foreach (var game in games)
        {
            var at = $"Game '{game.Slug}'";
            if (game.Slug is null || !SlugPattern().IsMatch(game.Slug) || game.Slug.Length > 64)
            {
                errors.Add($"{at}: slug must be lowercase letters, digits, and single hyphens (max 64).");
            }

            if (string.IsNullOrWhiteSpace(game.Title) || game.Title.Length > 120)
            {
                errors.Add($"{at}: title is required (max 120 characters).");
            }

            if (string.IsNullOrWhiteSpace(game.OriginalGame) || game.OriginalGame.Length > 120)
            {
                errors.Add($"{at}: originalGame (the game players need their own copy of) is required, max 120 characters.");
            }

            if (game.License is { Length: 0 or > 32 })
            {
                errors.Add($"{at}: license must be an SPDX id of 1–32 characters (leave it out when the project has none).");
            }

            if (!GameVocabulary.OriginalPlatforms.Contains(game.OriginalPlatform))
            {
                errors.Add($"{at}: unknown original platform '{game.OriginalPlatform}'.");
            }

            if (game.Platforms is null || game.Platforms.Length == 0 || game.Platforms.Any(platform => !GameVocabulary.Platforms.Contains(platform)))
            {
                errors.Add($"{at}: platforms must list at least one of {string.Join(", ", GameVocabulary.Platforms)}.");
            }

            if (game.RepoUrl is not null && (!Uri.TryCreate(game.RepoUrl, UriKind.Absolute, out var repo) || repo.Scheme != Uri.UriSchemeHttps || game.RepoUrl.Length > 300))
            {
                errors.Add($"{at}: repoUrl must be an https URL (max 300 characters).");
            }

            ValidateText(errors, at, "summary", game.Summary, 300);
            ValidateRelease(errors, at, game, today);
            ValidateSet(errors, at, game.CoreSet);
        }

        return errors;
    }

    private static void ValidateRelease(List<string> errors, string at, CatalogGame game, DateOnly today)
    {
        if (game.LatestVersion is { Length: 0 or > 32 })
        {
            errors.Add($"{at}: latestVersion must be 1–32 characters.");
        }

        if (game.ReleasedAt > today)
        {
            errors.Add($"{at}: releasedAt can't be in the future.");
        }

        if (game.HeroImage is { } image)
        {
            if (image.File is null || !ImageFilePattern().IsMatch(image.File))
            {
                errors.Add($"{at}: heroImage.file must be a lowercase name ending in .webp, .jpg, or .png.");
            }

            if (image.SourceUrl is not null && (!Uri.TryCreate(image.SourceUrl, UriKind.Absolute, out var source) || source.Scheme != Uri.UriSchemeHttps))
            {
                errors.Add($"{at}: heroImage.sourceUrl must be an https URL.");
            }

            ValidateText(errors, at, "heroImage.credit", image.Credit, 120);
        }
    }

    private static void ValidateSet(List<string> errors, string at, CatalogSet? set)
    {
        if (set?.Achievements is not { Length: > 0 } achievements)
        {
            errors.Add($"{at}: the core set needs at least one achievement.");
            return;
        }

        foreach (var duplicate in achievements.GroupBy(achievement => achievement.ApiKeyName).Where(group => group.Count() > 1))
        {
            errors.Add($"{at}: apiKeyName '{duplicate.Key}' is used more than once.");
        }

        foreach (var achievement in achievements)
        {
            var where = $"{at}, achievement '{achievement.ApiKeyName}'";
            if (achievement.ApiKeyName is null || !ApiKeyNamePattern().IsMatch(achievement.ApiKeyName) || achievement.ApiKeyName.Length > 64)
            {
                errors.Add($"{where}: apiKeyName must be UPPER_SNAKE_CASE (max 64).");
            }

            if (achievement.Points is < 1 or > 10)
            {
                errors.Add($"{where}: points must be between 1 and 10.");
            }

            if (!GameVocabulary.RarityTiers.Contains(achievement.RarityTier))
            {
                errors.Add($"{where}: unknown rarity tier '{achievement.RarityTier}'.");
            }

            if (!GameVocabulary.AchievementKinds.Contains(achievement.Kind))
            {
                errors.Add($"{where}: unknown kind '{achievement.Kind}'.");
            }

            if (achievement.ProgressionStep is < 1)
            {
                errors.Add($"{where}: progressionStep must be 1 or more.");
            }

            ValidateText(errors, where, "title", achievement.Title, 80);
            ValidateText(errors, where, "description", achievement.Description, 200);
        }

        if (!achievements.Any(achievement => achievement.Kind == "win_condition"))
        {
            errors.Add($"{at}: the core set needs at least one win_condition achievement.");
        }

        foreach (var (tier, percent) in RarityCaps)
        {
            var count = achievements.Count(achievement => achievement.RarityTier == tier);
            var allowed = achievements.Length * percent / 100;
            if (count > allowed)
            {
                errors.Add($"{at}: {count} {tier} achievements exceed the {percent}% cap ({allowed} allowed).");
            }
        }
    }

    private static readonly (string Tier, int Percent)[] RarityCaps = [("legendary", 10), ("epic", 20), ("rare", 30)];

    private static void ValidateText(List<string> errors, string where, string field, LocalizedText? text, int maxLength)
    {
        if (text is null || string.IsNullOrWhiteSpace(text.En))
        {
            errors.Add($"{where}: {field} needs English text.");
            return;
        }

        if (new[] { text.En, text.Es, text.Pt }.Any(value => value?.Length > maxLength))
        {
            errors.Add($"{where}: {field} is longer than {maxLength} characters.");
        }
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();

    [GeneratedRegex("^[A-Z0-9]+(_[A-Z0-9]+)*$")]
    private static partial Regex ApiKeyNamePattern();

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*\\.(webp|jpg|png)$")]
    private static partial Regex ImageFilePattern();
}
