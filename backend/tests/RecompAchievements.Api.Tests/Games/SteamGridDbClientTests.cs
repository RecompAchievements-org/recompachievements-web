using System.Net;
using System.Text;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Tests.Games;

// The real client against canned API answers (no network): which images it picks and how it falls back.
public sealed class SteamGridDbClientTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class CannedApi(Func<string, (HttpStatusCode Status, string Json)> answer) : HttpMessageHandler
    {
        public List<string> Paths { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.PathAndQuery;
            Paths.Add(path);
            var (status, json) = answer(path);
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }

    private static string Assets(params (int Id, int Score, string Host)[] assets) =>
        "{\"success\":true,\"data\":[" + string.Join(",", assets.Select(a =>
            $"{{\"id\":{a.Id},\"score\":{a.Score},\"url\":\"https://{a.Host}/file/{a.Id}.png\",\"author\":{{\"name\":\"Artist {a.Id}\"}}}}")) + "]}";

    private static SteamGridDbClient Client(CannedApi api) =>
        new(new HttpClient(api) { BaseAddress = new Uri("https://www.steamgriddb.com/api/v2/") }, TimeProvider.System);

    [Fact]
    public async Task Picks_the_best_scored_image_on_the_cdn_with_fallbacks()
    {
        var api = new CannedApi(path => path switch
        {
            _ when path.Contains("/search/autocomplete/", StringComparison.Ordinal) => (HttpStatusCode.OK, "{\"success\":true,\"data\":[{\"id\":77,\"name\":\"Some Game\"}]}"),
            // Best-scored cover is on another host, so the next one is used.
            _ when path.Contains("/grids/game/77", StringComparison.Ordinal) => (HttpStatusCode.OK, Assets((1, 50, "evil.example.com"), (2, 10, "cdn2.steamgriddb.com"))),
            // Heroes: no double-resolution or PNG/JPEG ones, found with only the safe filter.
            _ when path.Contains("/heroes/game/77?dimensions=3840x1240", StringComparison.Ordinal) => (HttpStatusCode.OK, "{\"success\":true,\"data\":[]}"),
            _ when path.Contains("/heroes/game/77?mimes", StringComparison.Ordinal) => (HttpStatusCode.OK, "{\"success\":true,\"data\":[]}"),
            _ when path.Contains("/heroes/game/77", StringComparison.Ordinal) => (HttpStatusCode.OK, Assets((3, 5, "cdn2.steamgriddb.com"))),
            // Icons: the API answers 404 when there are none.
            _ => (HttpStatusCode.NotFound, "{\"success\":false}"),
        });

        var art = await Client(api).FindAsync("Some Game", null, Ct);

        Assert.NotNull(art);
        Assert.True(art.AutoPicked);
        Assert.Equal("https://cdn2.steamgriddb.com/file/2.png", art.Cover?.Url);
        Assert.Equal("https://www.steamgriddb.com/grid/2", art.Cover?.SourceUrl);
        Assert.Equal("Artist 2", art.Cover?.Author);
        Assert.Equal("https://www.steamgriddb.com/hero/3", art.Hero?.SourceUrl);
        var heroCalls = api.Paths.Where(path => path.Contains("/heroes/", StringComparison.Ordinal)).ToList();
        Assert.Equal(3, heroCalls.Count);
        Assert.Contains("dimensions=3840x1240", heroCalls[0], StringComparison.Ordinal);
        Assert.Null(art.Icon);
    }

    [Fact]
    public async Task A_pinned_id_skips_the_search_and_no_match_returns_null()
    {
        var api = new CannedApi(_ => (HttpStatusCode.NotFound, "{\"success\":false}"));

        var art = await Client(api).FindAsync("Some Game", 4242, Ct);

        Assert.Null(art);
        Assert.DoesNotContain(api.Paths, path => path.Contains("/search/", StringComparison.Ordinal));
        Assert.Contains(api.Paths, path => path.Contains("/grids/game/4242", StringComparison.Ordinal));
    }
}
