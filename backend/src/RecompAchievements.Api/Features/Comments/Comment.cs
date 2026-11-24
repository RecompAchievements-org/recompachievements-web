using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Features.Comments;

/** A plain-text comment in one thread: a player's profile wall (WallUserId) or a game page (GameId).
 *  Exactly one of the two is set, enforced by the database. Its time-ordered id is the page cursor.
**/
public sealed class Comment
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid? WallUserId { get; init; }
    public Guid? GameId { get; init; }
    public Guid AuthorId { get; init; }
    public required string Body { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

internal sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable(table => table.HasCheckConstraint("ck_comments_one_thread", "num_nonnulls(wall_user_id, game_id) = 1"));
        builder.HasKey(comment => comment.Id);
        builder.Property(comment => comment.Body).HasMaxLength(CommentText.MaxLength);
        builder.HasIndex(comment => new { comment.WallUserId, comment.Id });
        builder.HasIndex(comment => new { comment.GameId, comment.Id });
        builder.HasIndex(comment => new { comment.AuthorId, comment.CreatedAt });
        builder.HasOne<User>().WithMany().HasForeignKey(comment => comment.WallUserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Game>().WithMany().HasForeignKey(comment => comment.GameId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(comment => comment.AuthorId).OnDelete(DeleteBehavior.Cascade);
    }
}
