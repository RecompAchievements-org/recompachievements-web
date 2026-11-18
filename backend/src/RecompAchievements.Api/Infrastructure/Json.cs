using System.Text.Json.Serialization;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Infrastructure;

// Source-generated JSON for every request and response type (no reflection on hot paths).
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(CreateAlphaSignupRequest))]
[JsonSerializable(typeof(ConfirmAlphaSignupRequest))]
[JsonSerializable(typeof(AlphaSignupAcceptedResponse))]
[JsonSerializable(typeof(AlphaSignupConfirmedResponse))]
[JsonSerializable(typeof(GameSummaryResponse[]))]
[JsonSerializable(typeof(GameDetailResponse))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

internal static class Json
{
    public static IServiceCollection AddJson(this IServiceCollection services)
    {
        services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));
        return services;
    }
}
