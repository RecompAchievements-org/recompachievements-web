using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Tests.Games;

/** Imports small test catalogs into the database directly. Each test uses its own factory (own
 *  database) because an import replaces every game, including the shipped catalog.
**/
public sealed class CatalogImportTests : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);

    private readonly ApiFactory _factory = new();

    public async ValueTask InitializeAsync()
    {
        await _factory.InitializeAsync();
        _ = _factory.Server; // Starts the API, which applies migrations and the shipped catalog.
    }

    public async ValueTask DisposeAsync() => await _factory.DisposeAsync();

    private static CatalogAchievement Achievement(string key, int points = 3, string tier = "common", string kind = "standard") =>
        new(key, new LocalizedText($"{key} title"), new LocalizedText($"{key} description"), points, tier, kind, null);

    private static CatalogGame TestGame(string slug, params CatalogAchievement[] achievements) =>
        new(slug, $"Game {slug}", "n64", $"Original {slug}", ["windows"], null, 1, new LocalizedText("Summary"),
            new CatalogSet([Achievement("FINISH", kind: "win_condition"), .. achievements]));

    private async Task Import(params CatalogGame[] games)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await CatalogImporter.ImportAsync(db, games, TimeProvider.System, Ct);
    }

    private async Task<(string Slug, string[] Keys, Guid[] Ids)[]> Snapshot()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var games = await db.Games.Include(game => game.Sets).ThenInclude(set => set.Achievements).OrderBy(game => game.Slug).ToListAsync(Ct);
        return [.. games.Select(game =>
        {
            var achievements = game.Sets.Single().Achievements.OrderBy(a => a.DisplayOrder).ToArray();
            return (game.Slug, achievements.Select(a => a.ApiKeyName).ToArray(), achievements.Select(a => a.Id).ToArray());
        })];
    }

    [Fact]
    public async Task Importing_twice_changes_nothing_and_keeps_ids()
    {
        var catalog = TestGame("alpha-game", Achievement("FIRST"), Achievement("SECOND"));

        await Import(catalog);
        var first = await Snapshot();
        await Import(catalog);
        var second = await Snapshot();

        var game = Assert.Single(second);
        Assert.Equal(["FINISH", "FIRST", "SECOND"], game.Keys);
        Assert.Equal(first[0].Ids, game.Ids);
    }

    [Fact]
    public async Task Entries_removed_from_the_catalog_are_deleted()
    {
        await Import(TestGame("kept-game", Achievement("STAYS"), Achievement("GOES")), TestGame("dropped-game"));

        await Import(TestGame("kept-game", Achievement("STAYS")));

        var game = Assert.Single(await Snapshot());
        Assert.Equal("kept-game", game.Slug);
        Assert.Equal(["FINISH", "STAYS"], game.Keys);
    }

    [Fact]
    public async Task Invalid_catalog_is_rejected_without_writing_anything()
    {
        await Import(TestGame("existing-game"));
        var invalid = TestGame("broken-game", Achievement("TOO_MANY_POINTS", points: 11), Achievement("TOO_MANY_POINTS"));

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => Import(invalid));

        Assert.Contains("points must be between 1 and 10", error.Message, StringComparison.Ordinal);
        Assert.Contains("used more than once", error.Message, StringComparison.Ordinal);
        Assert.Equal("existing-game", Assert.Single(await Snapshot()).Slug);
    }

    [Fact]
    public void Rarity_caps_are_enforced()
    {
        var game = TestGame("capped-game", Achievement("RARE_ONE", tier: "legendary"), Achievement("RARE_TWO", tier: "legendary"));

        var errors = Catalog.Validate([game], Today);

        Assert.Contains(errors, error => error.Contains("legendary achievements exceed the 10% cap", StringComparison.Ordinal));
    }

    [Fact]
    public void Shipped_catalog_is_valid()
    {
        var games = Catalog.Load(Catalog.DefaultDirectory);

        Assert.NotEmpty(games);
        Assert.Empty(Catalog.Validate(games, Today));
    }

    [Fact]
    public void Release_info_and_art_are_checked()
    {
        var game = TestGame("bad-release") with
        {
            ReleasedAt = Today.AddDays(1),
            LatestVersion = "",
            OriginalGame = " ",
            License = "",
            Art = new GameArt
            {
                Cover = new ArtImage { Url = "https://example.com/cover.png", SourceUrl = "http://www.steamgriddb.com/grid/1", Author = " " },
            },
        };

        var errors = Catalog.Validate([game], Today);

        Assert.Contains(errors, error => error.Contains("releasedAt can't be in the future", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("latestVersion must be", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("art.cover.url must be", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("art.cover.sourceUrl must be", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("art.cover.author", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("originalGame", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("license must be", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Release_info_and_art_are_imported()
    {
        // Placeholder links that pass validation; no image is fetched.
        var art = new GameArt
        {
            Cover = new ArtImage { Url = "https://cdn2.steamgriddb.com/grid/test-cover.png", SourceUrl = "https://www.steamgriddb.com/grid/1", Author = "Cover Artist" },
            Hero = new ArtImage { Url = "https://cdn2.steamgriddb.com/hero/test-hero.png", SourceUrl = "https://www.steamgriddb.com/hero/2", Author = "Hero Artist" },
        };
        await Import(TestGame("released-game") with { Featured = true, LatestVersion = "1.0.0", ReleasedAt = new DateOnly(2026, 1, 2), Art = art });

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var game = await db.Games.SingleAsync(Ct);
        Assert.True(game.Featured);
        Assert.Equal("1.0.0", game.LatestVersion);
        Assert.Equal(new DateOnly(2026, 1, 2), game.ReleasedAt);
        Assert.Equal(art.Cover, game.Art?.Cover);
        Assert.Equal(art.Hero, game.Art?.Hero);
        Assert.Null(game.Art?.Icon);
    }
}
