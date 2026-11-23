using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecompAchievements.Api.Features.Accounts;

namespace RecompAchievements.Api.Features.Walls;

// A plain-text comment on a player's public profile wall. Its time-ordered id is the page cursor.
public sealed class WallComment
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid WallUserId { get; init; }
    public Guid AuthorId { get; init; }
    public required string Body { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

internal sealed class WallCommentConfiguration : IEntityTypeConfiguration<WallComment>
{
    public void Configure(EntityTypeBuilder<WallComment> builder)
    {
        builder.HasKey(comment => comment.Id);
        builder.Property(comment => comment.Body).HasMaxLength(WallText.MaxLength);
        builder.HasIndex(comment => new { comment.WallUserId, comment.Id });
        builder.HasIndex(comment => new { comment.AuthorId, comment.CreatedAt });
        builder.HasOne<User>().WithMany().HasForeignKey(comment => comment.WallUserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(comment => comment.AuthorId).OnDelete(DeleteBehavior.Cascade);
    }
}
