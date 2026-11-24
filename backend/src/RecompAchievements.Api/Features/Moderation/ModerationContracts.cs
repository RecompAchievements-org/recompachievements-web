using System.ComponentModel.DataAnnotations;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Comments;

namespace RecompAchievements.Api.Features.Moderation;

internal static class ModerationText
{
    public const int MaxLength = 500;

    public static string? Clean(string? text) => string.IsNullOrWhiteSpace(text) ? null : CommentText.Clean(text);

    public static IEnumerable<ValidationResult> CheckReason(string? reason)
    {
        if (reason is not null && !CommentText.IsAllowed(reason))
        {
            yield return new ValidationResult("The reason has no visible text or contains characters that aren't allowed.", ["Reason"]);
        }
    }
}

public sealed record CreateReportRequest(
    [property: Required, AllowedValues(ReportTargets.Profile, ReportTargets.Photo, ReportTargets.Comment)] string TargetType,
    [property: Required, RegularExpression(AccountRules.UsernamePattern)] string TargetUsername,
    Guid? CommentId,
    [property: Required, AllowedValues("sexual", "violence", "hate", "harassment", "copyright", "personal_info", "spam", "other")] string Reason,
    [property: MaxLength(ModerationText.MaxLength)] string? Details) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!string.IsNullOrWhiteSpace(Details) && !CommentText.IsAllowed(Details))
        {
            yield return new ValidationResult("The details contain characters that aren't allowed.", [nameof(Details)]);
        }

        if (TargetType == ReportTargets.Comment && CommentId is null)
        {
            yield return new ValidationResult("A comment report needs the comment.", [nameof(CommentId)]);
        }
    }
}

public sealed record ModerationReasonRequest(
    [property: Required, MaxLength(ModerationText.MaxLength)] string Reason,
    Guid? ReportId) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) => ModerationText.CheckReason(Reason);
}

public sealed record MuteRequest(
    [property: Required, MaxLength(ModerationText.MaxLength)] string Reason,
    [property: Range(1, 365)] int Days,
    Guid? ReportId) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) => ModerationText.CheckReason(Reason);
}

public sealed record ChangeRoleRequest(
    [property: Required, AllowedValues(UserRoles.Player, UserRoles.Moderator, UserRoles.Admin)] string Role,
    [property: Required, MaxLength(ModerationText.MaxLength)] string Reason) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) => ModerationText.CheckReason(Reason);
}

public sealed record ReportSummaryResponse(
    Guid Id,
    string TargetType,
    string Reason,
    string Status,
    string? ReporterUsername,
    string? ReportedUsername,
    string? Details,
    DateTimeOffset CreatedAt);

public sealed record ReportPageResponse(ReportSummaryResponse[] Reports, Guid? NextCursor);

public sealed record ReportDetailResponse(
    ReportSummaryResponse Report,
    string TargetKey,
    string? Snapshot,
    bool TargetStillExists,
    string? ResolvedByUsername,
    DateTimeOffset? ResolvedAt,
    string? ResolutionNote,
    CommentLocationResponse? CommentLocation,
    ModerationUserResponse? ReportedUser);

// Where a reported comment is shown: Kind "wall" with the wall owner's username, or "game" with its slug.
public sealed record CommentLocationResponse(string Kind, string Key);

public sealed record ModerationActionResponse(
    Guid Id,
    string? ModeratorUsername,
    string? TargetUsername,
    string Action,
    string Reason,
    string? Evidence,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset CreatedAt);

public sealed record ModerationActionPageResponse(ModerationActionResponse[] Actions, Guid? NextCursor);

// What staff need to judge an account. It deliberately has no email or platform IDs.
public sealed record ModerationUserResponse(
    string Username,
    string Role,
    bool IsEnabled,
    bool IsMuted,
    DateTimeOffset? MutedUntil,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastActivityAt,
    PlayerAvatarResponse? Avatar,
    int OpenReports,
    ModerationActionResponse[] RecentActions);

public sealed record ModerationResultResponse(string Status, bool CachePurged);
