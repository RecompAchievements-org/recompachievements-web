using System.Text.Json.Serialization;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Comments;
using RecompAchievements.Api.Features.Forum;
using RecompAchievements.Api.Features.Games;
using RecompAchievements.Api.Features.Moderation;
using RecompAchievements.Api.Infrastructure.Media;

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
[JsonSerializable(typeof(CreateCommentRequest))]
[JsonSerializable(typeof(CommentResponse))]
[JsonSerializable(typeof(CommentPageResponse))]
[JsonSerializable(typeof(CommentLocationResponse))]
[JsonSerializable(typeof(PlayerAvatarResponse))]
[JsonSerializable(typeof(CreateReportRequest))]
[JsonSerializable(typeof(ModerationReasonRequest))]
[JsonSerializable(typeof(MuteRequest))]
[JsonSerializable(typeof(ChangeRoleRequest))]
[JsonSerializable(typeof(ReportPageResponse))]
[JsonSerializable(typeof(ReportDetailResponse))]
[JsonSerializable(typeof(ModerationActionPageResponse))]
[JsonSerializable(typeof(ModerationUserResponse))]
[JsonSerializable(typeof(ModerationResultResponse))]
[JsonSerializable(typeof(MediaPurgeRequest))]
[JsonSerializable(typeof(SaveForumPostRequest))]
[JsonSerializable(typeof(ForumCategoryResponse[]))]
[JsonSerializable(typeof(ForumPostPageResponse))]
[JsonSerializable(typeof(ForumPostResponse))]
[JsonSerializable(typeof(ForumPostSourceResponse))]
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
