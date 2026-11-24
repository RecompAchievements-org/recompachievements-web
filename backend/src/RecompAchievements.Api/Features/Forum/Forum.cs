using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Games;

namespace RecompAchievements.Api.Features.Forum;

/** A forum section. AdminOnly limits who may start posts, and CommentsEnabled decides whether its
 *  posts take comments; both are per category, so official News stays closed while future
 *  community categories can open them.
**/
public sealed class ForumCategory
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Key { get; init; }
    public required LocalizedText Name { get; set; }
    public required LocalizedText Description { get; set; }
    public bool AdminOnly { get; set; }
    public bool CommentsEnabled { get; set; }
    public int DisplayOrder { get; set; }
}

// A forum post written in Markdown (a safe subset the website renders); English is required.
public sealed class ForumPost
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid CategoryId { get; init; }
    public required string Slug { get; set; }
    public required LocalizedText Title { get; set; }
    public required LocalizedText Body { get; set; }
    public string Status { get; set; } = ForumPostStatus.Draft;
    public Guid? AuthorId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset? EditedAt { get; set; }

    // Set while the post is pinned; pinned posts are listed newest pin first.
    public DateTimeOffset? PinnedAt { get; set; }
}

internal static class ForumPostStatus
{
    public const string Draft = "draft";
    public const string Published = "published";
}

internal sealed class ForumCategoryConfiguration : IEntityTypeConfiguration<ForumCategory>
{
    public void Configure(EntityTypeBuilder<ForumCategory> builder)
    {
        builder.HasKey(category => category.Id);
        builder.Property(category => category.Key).HasMaxLength(32);
        builder.HasIndex(category => category.Key).IsUnique();
        builder.ComplexProperty(category => category.Name, text => text.ToJson());
        builder.ComplexProperty(category => category.Description, text => text.ToJson());
    }
}

internal sealed class ForumPostConfiguration : IEntityTypeConfiguration<ForumPost>
{
    public void Configure(EntityTypeBuilder<ForumPost> builder)
    {
        builder.HasKey(post => post.Id);
        builder.Property(post => post.Slug).HasMaxLength(ForumText.MaxSlugLength);
        builder.Property(post => post.Status).HasMaxLength(16);
        builder.ComplexProperty(post => post.Title, text => text.ToJson());
        builder.ComplexProperty(post => post.Body, text => text.ToJson());
        builder.HasIndex(post => new { post.CategoryId, post.Slug }).IsUnique();
        builder.HasIndex(post => new { post.CategoryId, post.Status, post.PublishedAt });
        builder.HasIndex(post => new { post.CategoryId, post.PinnedAt }).HasFilter("pinned_at IS NOT NULL");
        builder.HasOne<ForumCategory>().WithMany().HasForeignKey(post => post.CategoryId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<User>().WithMany().HasForeignKey(post => post.AuthorId).OnDelete(DeleteBehavior.SetNull);
    }
}
