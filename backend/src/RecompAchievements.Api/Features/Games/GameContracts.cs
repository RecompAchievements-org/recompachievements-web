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
    GameImageResponse? HeroImage);

public sealed record GameDetailResponse(
    string Slug,
    string Title,
    string OriginalPlatform,
    string[] Platforms,
    string Summary,
    string? RepoUrl,
    string? LatestVersion,
    DateOnly? ReleasedAt,
    GameImageResponse? HeroImage,
    AchievementSetResponse CoreSet);

// Url is a path on the website (/games/<slug>/<file>), where approved image files are served.
public sealed record GameImageResponse(string Url, string Credit, string? SourceUrl)
{
    public static GameImageResponse? From(string slug, GameImage? image, string lang) =>
        image is null ? null : new($"/games/{slug}/{image.File}", image.Credit.For(lang), image.SourceUrl);
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
