using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RecompAchievements.Api.Features.Moderation;

internal static class ReportTargets
{
    public const string Profile = "profile";
    public const string Photo = "photo";
    public const string Comment = "comment";
}

internal static class ReportStatuses
{
    public const string Open = "open";
    public const string Resolved = "resolved";
    public const string Dismissed = "dismissed";
}

internal static class ModerationActionKinds
{
    public const string RemovePhoto = "remove_photo";
    public const string RemoveComment = "remove_comment";
    public const string Mute = "mute";
    public const string Unmute = "unmute";
    public const string Disable = "disable";
    public const string Enable = "enable";
    public const string ChangeRole = "change_role";
    public const string ResolveReport = "resolve_report";
    public const string DismissReport = "dismiss_report";
    public const string LegalHold = "legal_hold";
}

/** A player's report about a profile, photo, or wall comment. TargetKey identifies what was
 *  reported, and Snapshot keeps reported text so a review still works after the author deletes it.
 *  User IDs aren't foreign keys, so the record survives when an account is deleted.
**/
public sealed class ModerationReport
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid ReporterId { get; init; }
    public Guid ReportedUserId { get; init; }
    public required string TargetType { get; init; }
    public required string TargetKey { get; init; }
    public required string Reason { get; init; }
    public string? Details { get; init; }
    public string? Snapshot { get; set; }
    public string Status { get; set; } = ReportStatuses.Open;
    public Guid? ResolvedById { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string? ResolutionNote { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
}

// One entry in the append-only audit log of what staff did and why.
public sealed class ModerationAction
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid ModeratorId { get; init; }
    public Guid TargetUserId { get; init; }
    public required string Action { get; init; }
    public Guid? ReportId { get; init; }
    public required string Reason { get; init; }
    public string? Evidence { get; set; }
    public DateTimeOffset? ExpiresAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

internal sealed class ModerationReportConfiguration : IEntityTypeConfiguration<ModerationReport>
{
    public void Configure(EntityTypeBuilder<ModerationReport> builder)
    {
        builder.HasKey(report => report.Id);
        builder.Property(report => report.TargetType).HasMaxLength(16);
        builder.Property(report => report.TargetKey).HasMaxLength(128);
        builder.Property(report => report.Reason).HasMaxLength(16);
        builder.Property(report => report.Details).HasMaxLength(ModerationText.MaxLength);
        builder.Property(report => report.Snapshot).HasMaxLength(1000);
        builder.Property(report => report.Status).HasMaxLength(16);
        builder.Property(report => report.ResolutionNote).HasMaxLength(ModerationText.MaxLength);
        builder.HasIndex(report => new { report.Status, report.Id });
        builder.HasIndex(report => new { report.ReportedUserId, report.Id });
        builder.HasIndex(report => new { report.ReporterId, report.CreatedAt });
        builder.HasIndex(report => new { report.ReporterId, report.TargetType, report.TargetKey })
            .IsUnique()
            .HasFilter("status = 'open'");
    }
}

internal sealed class ModerationActionConfiguration : IEntityTypeConfiguration<ModerationAction>
{
    public void Configure(EntityTypeBuilder<ModerationAction> builder)
    {
        builder.HasKey(action => action.Id);
        builder.Property(action => action.Action).HasMaxLength(24);
        builder.Property(action => action.Reason).HasMaxLength(ModerationText.MaxLength);
        builder.Property(action => action.Evidence).HasMaxLength(1000);
        builder.HasIndex(action => new { action.TargetUserId, action.Id });
        builder.HasIndex(action => action.CreatedAt);
    }
}
