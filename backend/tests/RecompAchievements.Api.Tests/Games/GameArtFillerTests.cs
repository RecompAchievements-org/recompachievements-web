using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Tests.Games;

/** Catalog games without art get it once from the art source (a fake here; no API is called),
 *  keep it across imports, and never override curated or opted-out art.
**/
public sealed class GameArtFillerTests : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly ApiFactory _factory = new();

    public async ValueTask InitializeAsync()
    {
        await _factory.InitializeAsync();
        _ = _factory.Server;
    }

    public async ValueTask DisposeAsync() => await _factory.DisposeAsync();

    private static ArtImage Image(string kind, int id) => new()
    {
        Url = $"https://cdn2.steamgriddb.com/{kind}/test-{id}.png",
        SourceUrl = $"https://www.steamgriddb.com/{kind}/{id}",
        Author = $"Artist {id}",
    };

    private sealed class FakeArtSource(Func<GameArt?> answer) : IGameArtSource
    {
        public List<(string Title, int? Id)> Calls { get; } = [];

        public Task<GameArt?> FindAsync(string originalGame, int? steamGridDbId, CancellationToken cancellationToken)
        {
            Calls.Add((originalGame, steamGridDbId));
            return Task.FromResult(answer());
        }
    }

    private static readonly GameArt Picked = new() { Cover = Image("grid", 1), Hero = Image("hero", 2), AutoPicked = true };

    private static CatalogGame Game(GameArt? art = null, int? steamGridDbId = null) =>
        new("art-game", "Art Game", "ps2", "Original Art Game", ["windows"], null, 1, new LocalizedText("Summary"),
            new CatalogSet([new CatalogAchievement("FINISH", new LocalizedText("Finish"), new LocalizedText("Finish it"), 5, "common", "win_condition", null)]),
            Art: art, SteamGridDbId: steamGridDbId);

    private async Task Import(CatalogGame game)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        await CatalogImporter.ImportAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), [game], TimeProvider.System, Ct);
    }

    private async Task Fill(IGameArtSource source)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        await GameArtFiller.FillMissingAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), source, NullLogger.Instance, Ct);
    }

    private async Task<GameArt?> StoredArt()
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        return (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Games.SingleAsync(Ct)).Art;
    }

    [Fact]
    public async Task Game_without_catalog_art_gets_it_once_and_keeps_it()
    {
        var source = new FakeArtSource(() => Picked);

        await Import(Game());
        await Fill(source);
        await Import(Game());
        await Fill(source);

        Assert.Equal([("Original Art Game", (int?)null)], source.Calls);
        var art = await StoredArt();
        Assert.True(art?.AutoPicked);
        Assert.Equal(Picked.Cover, art?.Cover);
    }

    [Fact]
    public async Task Catalog_art_replaces_picked_art_and_is_never_fetched()
    {
        var source = new FakeArtSource(() => Picked);
        await Import(Game());
        await Fill(source);

        var curated = new GameArt { Cover = Image("grid", 9) };
        await Import(Game(curated));
        await Fill(source);

        Assert.Single(source.Calls);
        var art = await StoredArt();
        Assert.False(art?.AutoPicked);
        Assert.Equal(curated.Cover, art?.Cover);
    }

    [Fact]
    public async Task Empty_catalog_art_opts_out_of_picking()
    {
        var source = new FakeArtSource(() => Picked);

        await Import(Game(new GameArt()));
        await Fill(source);

        Assert.Empty(source.Calls);
        var art = await StoredArt();
        Assert.NotNull(art);
        Assert.Null(art.Cover);
    }

    [Fact]
    public async Task Changing_the_SteamGridDB_id_picks_art_again()
    {
        var source = new FakeArtSource(() => Picked);
        await Import(Game());
        await Fill(source);

        await Import(Game(steamGridDbId: 4242));
        await Fill(source);

        Assert.Equal([("Original Art Game", (int?)null), ("Original Art Game", (int?)4242)], source.Calls);
    }

    [Fact]
    public async Task A_failed_lookup_leaves_the_game_without_art()
    {
        await Import(Game());

        await Fill(new FakeArtSource(() => throw new HttpRequestException("unreachable")));

        Assert.Null(await StoredArt());
    }

    [Fact]
    public async Task Any_lookup_error_is_skipped_instead_of_stopping_the_api()
    {
        await Import(Game());

        // A timeout from the resilience pipeline or a malformed reply isn't an HttpRequestException.
        await Fill(new FakeArtSource(() => throw new InvalidOperationException("unexpected reply")));

        Assert.Null(await StoredArt());
    }

    [Fact]
    public void Catalog_cannot_mark_art_as_picked_or_use_a_bad_id()
    {
        var errors = Catalog.Validate([Game(new GameArt { AutoPicked = true }, steamGridDbId: 0)], DateOnly.FromDateTime(DateTime.UtcNow));

        Assert.Contains(errors, error => error.Contains("autoPicked is set by the API", StringComparison.Ordinal));
        Assert.Contains(errors, error => error.Contains("steamGridDbId must be", StringComparison.Ordinal));
    }
}
