namespace RecompAchievements.Api.Features.Games;

// Text fields are already resolved to the requested language (English when a translation is missing).
public sealed record GameSummaryResponse(
    string Slug,
    string Title,
    string OriginalPlatform,
    string[] Platforms,
    string Summary,
    string SetStatus,
    int AchievementCount,
    int TotalPoints,
    bool Featured,
    string? LatestVersion,
    DateOnly? ReleasedAt,
    GameArtResponse? Art);

public sealed record GameDetailResponse(
    string Slug,
    string Title,
    string OriginalPlatform,
    string[] Platforms,
    string Summary,
    string OriginalGame,
    string? RepoUrl,
    string? License,
    string? LatestVersion,
    DateOnly? ReleasedAt,
    GameArtResponse? Art,
    AchievementSetResponse CoreSet);

// A game's SteamGridDB art; each image carries its page and artist for the credits.
public sealed record GameArtResponse(ArtImageResponse? Cover, ArtImageResponse? Hero, ArtImageResponse? Icon)
{
    public static GameArtResponse? From(GameArt? art) =>
        art is null ? null : new(ArtImageResponse.From(art.Cover), ArtImageResponse.From(art.Hero), ArtImageResponse.From(art.Icon));
}

public sealed record ArtImageResponse(string Url, string SourceUrl, string Author)
{
    public static ArtImageResponse? From(ArtImage? image) =>
        image is null ? null : new(image.Url, image.SourceUrl, image.Author);
}

public sealed record AchievementSetResponse(
    string Status,
    int AchievementCount,
    int TotalPoints,
    AchievementResponse[] Achievements);

public sealed record AchievementResponse(
    string ApiKeyName,
    string Title,
    string Description,
    int Points,
    string RarityTier,
    string Kind,
    int? ProgressionStep);
