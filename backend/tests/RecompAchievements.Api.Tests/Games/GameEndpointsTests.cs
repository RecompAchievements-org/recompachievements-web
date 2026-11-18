using System.Net;
using System.Net.Http.Json;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Tests.Games;

// Runs against the shipped catalog, which ApiFactory imports at startup.
public sealed class GameEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly IReadOnlyList<CatalogGame> Shipped = Catalog.Load(Catalog.DefaultDirectory);

    [Fact]
    public async Task List_returns_every_catalog_game_in_display_order_with_totals()
    {
        using var client = factory.CreateWebsiteClient();

        var games = await client.GetFromJsonAsync<GameSummaryResponse[]>("/api/v1/games", Ct);

        Assert.NotNull(games);
        var expected = Shipped.OrderBy(game => game.DisplayOrder).ToArray();
        Assert.Equal(expected.Select(game => game.Slug), games.Select(game => game.Slug));
        Assert.All(games, game => Assert.Equal("preview", game.SetStatus));
        var first = expected[0];
        Assert.Equal(first.CoreSet.Achievements.Length, games[0].AchievementCount);
        Assert.Equal(first.CoreSet.Achievements.Sum(achievement => achievement.Points), games[0].TotalPoints);
        Assert.Equal(first.Featured, games[0].Featured);
        Assert.Equal(first.LatestVersion, games[0].LatestVersion);
        Assert.Equal(first.ReleasedAt, games[0].ReleasedAt);
    }

    [Fact]
    public async Task Detail_returns_achievements_in_catalog_order()
    {
        using var client = factory.CreateWebsiteClient();
        var expected = Shipped[0];

        var game = await client.GetFromJsonAsync<GameDetailResponse>($"/api/v1/games/{expected.Slug}", Ct);

        Assert.NotNull(game);
        Assert.Equal(expected.Title, game.Title);
        Assert.Equal(expected.CoreSet.Achievements.Select(a => a.ApiKeyName), game.CoreSet.Achievements.Select(a => a.ApiKeyName));
        Assert.Equal(expected.CoreSet.Achievements[0].Title.En, game.CoreSet.Achievements[0].Title);
    }

    [Fact]
    public async Task Detail_is_translated_when_a_language_is_requested()
    {
        using var client = factory.CreateWebsiteClient();
        var expected = Shipped[0];

        var game = await client.GetFromJsonAsync<GameDetailResponse>($"/api/v1/games/{expected.Slug}?lang=es", Ct);

        Assert.NotNull(game);
        Assert.Equal(expected.Summary.Es, game.Summary);
        Assert.Equal(expected.CoreSet.Achievements[0].Description.Es, game.CoreSet.Achievements[0].Description);
    }

    [Fact]
    public void Missing_translation_falls_back_to_english()
    {
        var text = new LocalizedText("Hello", Es: "Hola");

        Assert.Equal("Hola", text.For("es"));
        Assert.Equal("Hello", text.For("pt"));
        Assert.Equal("Hello", text.For("en"));
    }

    [Fact]
    public async Task Unknown_game_is_a_404_problem()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await client.GetAsync("/api/v1/games/not-a-game", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Unknown_language_is_rejected()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await client.GetAsync("/api/v1/games?lang=fr", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Games_require_the_internal_key()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/v1/games", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
