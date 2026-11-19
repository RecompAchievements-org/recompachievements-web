using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace RecompAchievements.Api.Features.Games;

// Finds art for a game; null when nothing suitable exists.
public interface IGameArtSource
{
    Task<GameArt?> FindAsync(string originalGame, int? steamGridDbId, CancellationToken cancellationToken);
}

/** Picks art through SteamGridDB's official API (v2), the use its terms allow for apps: the game by
 *  its SteamGridDB id, or the first search match for its original title; then the best-scored
 *  static, safe-for-work image of each kind (600×900 grid, hero preferring 3840×1240, PNG icon),
 *  falling back to looser filters when the preferred ones find nothing. Returns links, pages, and
 *  artists only; no image is downloaded.
**/
internal sealed class SteamGridDbClient(HttpClient http, TimeProvider time) : IGameArtSource
{
    private const string SafeFilter = "types=static&nsfw=false&humor=false&epilepsy=false";
    private static readonly TimeSpan PauseBetweenCalls = TimeSpan.FromMilliseconds(500);
    private static readonly SteamGridDbJsonContext Json = SteamGridDbJsonContext.Default;

    public async Task<GameArt?> FindAsync(string originalGame, int? steamGridDbId, CancellationToken cancellationToken)
    {
        var gameId = steamGridDbId ?? (await GetAsync($"search/autocomplete/{Uri.EscapeDataString(originalGame)}", Json.SteamGridDbResponseSteamGridDbGame, cancellationToken)).FirstOrDefault()?.Id;
        if (gameId is null)
        {
            return null;
        }

        var art = new GameArt
        {
            Cover = await PickAsync("grids", "grid", gameId.Value, ["dimensions=600x900&mimes=image/png,image/jpeg"], cancellationToken),
            // Double-resolution heroes first: the slider crops and enlarges them, so 1920×620 ones look soft.
            Hero = await PickAsync("heroes", "hero", gameId.Value, ["dimensions=3840x1240&mimes=image/png,image/jpeg", "mimes=image/png,image/jpeg"], cancellationToken),
            Icon = await PickAsync("icons", "icon", gameId.Value, ["mimes=image/png"], cancellationToken),
            AutoPicked = true,
        };
        return art.Cover is null && art.Hero is null && art.Icon is null ? null : art;
    }

    // Tries each filter in order (preferred first), then only the safe-for-work filter.
    private async Task<ArtImage?> PickAsync(string endpoint, string page, int gameId, string[] filters, CancellationToken cancellationToken)
    {
        SteamGridDbAsset[] assets = [];
        foreach (var query in filters.Select(filter => $"{filter}&{SafeFilter}").Append(SafeFilter))
        {
            assets = await GetAsync($"{endpoint}/game/{gameId}?{query}", Json.SteamGridDbResponseSteamGridDbAsset, cancellationToken);
            if (assets.Length > 0)
            {
                break;
            }
        }

        return assets
            .OrderByDescending(asset => asset.Score)
            .Select(asset => new ArtImage { Url = asset.Url, SourceUrl = $"https://www.steamgriddb.com/{page}/{asset.Id}", Author = asset.Author?.Name ?? "" })
            .FirstOrDefault(Catalog.IsAllowedArtImage);
    }

    // The API answers 404 (or 400 for some filter combinations) when there is nothing to return.
    private async Task<T[]> GetAsync<T>(string path, JsonTypeInfo<SteamGridDbResponse<T>> typeInfo, CancellationToken cancellationToken)
    {
        await Task.Delay(PauseBetweenCalls, time, cancellationToken);
        using var response = await http.GetAsync(path, cancellationToken);
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            return [];
        }

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync(typeInfo, cancellationToken);
        return body?.Data ?? [];
    }
}

internal sealed record SteamGridDbResponse<T>(bool Success, T[]? Data);

internal sealed record SteamGridDbGame(int Id, string Name);

internal sealed record SteamGridDbAsset(int Id, int Score, string Url, SteamGridDbAuthor? Author);

internal sealed record SteamGridDbAuthor(string Name);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(SteamGridDbResponse<SteamGridDbGame>))]
[JsonSerializable(typeof(SteamGridDbResponse<SteamGridDbAsset>))]
internal sealed partial class SteamGridDbJsonContext : JsonSerializerContext;

internal static class GameArtSetup
{
    /** With "SteamGridDb:ApiKey" set, games without catalog art get it once after startup
     *  (GameArtFiller). Without a key (local development, tests) nothing is fetched.
    **/
    public static IServiceCollection AddGameArt(this IServiceCollection services, IConfiguration configuration)
    {
        var apiKey = configuration["SteamGridDb:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return services;
        }

        services.AddHttpClient<IGameArtSource, SteamGridDbClient>(client =>
            {
                client.BaseAddress = new Uri("https://www.steamgriddb.com/api/v2/");
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            })
            .AddStandardResilienceHandler();
        services.AddHostedService<GameArtFiller>();
        return services;
    }
}
