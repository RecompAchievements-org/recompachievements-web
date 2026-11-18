using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RecompAchievements.Api.Features.Games;

// A recomp registered on the platform, identified in URLs by its slug.
public sealed class Game
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Slug { get; init; }
    public required string Title { get; set; }
    public required string OriginalPlatform { get; set; }
    public required string OriginalGame { get; set; }
    public required string[] Platforms { get; set; }
    public required LocalizedText Summary { get; set; }
    public string? RepoUrl { get; set; }
    public string? License { get; set; }
    public int DisplayOrder { get; set; }
    public bool Featured { get; set; }
    public string? LatestVersion { get; set; }
    public DateOnly? ReleasedAt { get; set; }
    public GameImage? HeroImage { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; set; }
    public List<AchievementSet> Sets { get; init; } = [];
}

// A group of a game's achievements; every game has one core set (subsets come later).
public sealed class AchievementSet
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid GameId { get; init; }
    public string Kind { get; init; } = AchievementSetKind.Core;
    public required string Status { get; set; }
    public List<Achievement> Achievements { get; init; } = [];
}

public sealed class Achievement
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid SetId { get; init; }
    public required string ApiKeyName { get; init; }
    public required LocalizedText Title { get; set; }
    public required LocalizedText Description { get; set; }
    public int Points { get; set; }
    public required string RarityTier { get; set; }
    public required string Kind { get; set; }
    public int? ProgressionStep { get; set; }
    public int DisplayOrder { get; set; }
}

/** Text shown in each site language. English is required; Spanish and Portuguese fall back to
 *  English when missing.
**/
public sealed record LocalizedText(string En, string? Es = null, string? Pt = null)
{
    public string For(string locale) => locale switch
    {
        "es" => Es ?? En,
        "pt" => Pt ?? En,
        _ => En,
    };
}

/** An image shown for a game: a screenshot or banner published by the recomp project with its
 *  permission, or our own gameplay screenshot. Never official box art, key art, or logos. The file
 *  lives in the website (public/games/<slug>/<file>); the credit is shown next to it.
**/
public sealed record GameImage
{
    public required string File { get; init; }
    public required LocalizedText Credit { get; init; }
    public string? SourceUrl { get; init; }
}

internal static class AchievementSetKind
{
    public const string Core = "core";
}

// A preview set is shown on the site but not active: no unlocks are accepted for it yet.
internal static class AchievementSetStatus
{
    public const string Preview = "preview";
}

internal static class GameVocabulary
{
    public static readonly string[] OriginalPlatforms = ["n64", "gamecube", "wii", "ps1", "ps2", "ps3", "ps4", "xbox", "xbox360"];
    public static readonly string[] Platforms = ["windows", "linux", "macos", "steam_deck"];
    public static readonly string[] RarityTiers = ["common", "uncommon", "rare", "epic", "legendary"];
    public static readonly string[] AchievementKinds = ["progression", "win_condition", "standard"];
}

internal sealed class GameConfiguration : IEntityTypeConfiguration<Game>
{
    public void Configure(EntityTypeBuilder<Game> builder)
    {
        builder.HasKey(game => game.Id);
        builder.HasIndex(game => game.Slug).IsUnique();
        builder.Property(game => game.Slug).HasMaxLength(64);
        builder.Property(game => game.Title).HasMaxLength(120);
        builder.Property(game => game.OriginalPlatform).HasMaxLength(16);
        builder.Property(game => game.OriginalGame).HasMaxLength(120);
        builder.Property(game => game.License).HasMaxLength(32);
        builder.Property(game => game.RepoUrl).HasMaxLength(300);
        builder.Property(game => game.LatestVersion).HasMaxLength(32);
        builder.ComplexProperty(game => game.Summary, text => text.ToJson());
        builder.ComplexProperty(game => game.HeroImage, image => image.ToJson());
        builder.HasMany(game => game.Sets).WithOne().HasForeignKey(set => set.GameId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class AchievementSetConfiguration : IEntityTypeConfiguration<AchievementSet>
{
    public void Configure(EntityTypeBuilder<AchievementSet> builder)
    {
        builder.HasKey(set => set.Id);
        builder.Property(set => set.Kind).HasMaxLength(16);
        builder.Property(set => set.Status).HasMaxLength(16);
        builder.HasIndex(set => set.GameId).IsUnique().HasFilter("kind = 'core'");
        builder.HasMany(set => set.Achievements).WithOne().HasForeignKey(achievement => achievement.SetId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class AchievementConfiguration : IEntityTypeConfiguration<Achievement>
{
    public void Configure(EntityTypeBuilder<Achievement> builder)
    {
        builder.HasKey(achievement => achievement.Id);
        builder.HasIndex(achievement => new { achievement.SetId, achievement.ApiKeyName }).IsUnique();
        builder.Property(achievement => achievement.ApiKeyName).HasMaxLength(64);
        builder.Property(achievement => achievement.RarityTier).HasMaxLength(16);
        builder.Property(achievement => achievement.Kind).HasMaxLength(16);
        builder.ComplexProperty(achievement => achievement.Title, text => text.ToJson());
        builder.ComplexProperty(achievement => achievement.Description, text => text.ToJson());
        builder.ToTable(table => table.HasCheckConstraint("ck_achievements_points", "points BETWEEN 1 AND 10"));
    }
}
