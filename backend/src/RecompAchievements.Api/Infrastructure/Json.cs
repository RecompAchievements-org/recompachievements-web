using System.Text.Json.Serialization;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Games;
using RecompAchievements.Api.Features.Walls;

namespace RecompAchievements.Api.Infrastructure;

// Source-generated JSON for every request and response type (no reflection on hot paths).
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(CreateAlphaSignupRequest))]
[JsonSerializable(typeof(ConfirmAlphaSignupRequest))]
[JsonSerializable(typeof(AlphaSignupAcceptedResponse))]
[JsonSerializable(typeof(AlphaSignupConfirmedResponse))]
[JsonSerializable(typeof(GameSummaryResponse[]))]
[JsonSerializable(typeof(GameDetailResponse))]
[JsonSerializable(typeof(RegisterRequest))]
[JsonSerializable(typeof(EmailRequest))]
[JsonSerializable(typeof(TokenRequest))]
[JsonSerializable(typeof(SignInRequest))]
[JsonSerializable(typeof(ResetPasswordRequest))]
[JsonSerializable(typeof(OAuthCodeRequest))]
[JsonSerializable(typeof(CompleteSignupRequest))]
[JsonSerializable(typeof(AcceptedResponse))]
[JsonSerializable(typeof(StatusResponse))]
[JsonSerializable(typeof(SessionResponse))]
[JsonSerializable(typeof(UsernameAvailabilityResponse))]
[JsonSerializable(typeof(ProvidersResponse))]
[JsonSerializable(typeof(OAuthStartResponse))]
[JsonSerializable(typeof(OAuthSignInResponse))]
[JsonSerializable(typeof(ConnectResponse))]
[JsonSerializable(typeof(MeResponse))]
[JsonSerializable(typeof(PublicPlayerResponse))]
[JsonSerializable(typeof(CreateWallCommentRequest))]
[JsonSerializable(typeof(WallCommentResponse))]
[JsonSerializable(typeof(WallPageResponse))]
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
