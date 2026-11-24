using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Comments;

/** The rules every comment thread shares: newest-first pages that hide disabled authors, who may
 *  post (an enabled account with a confirmed email and no active mute), and a per-author posting
 *  limit counted across all threads, so moving between walls and games doesn't reset it.
**/
internal static class CommentThreads
{
    private const int PageSize = 20;
    private const int MaxCommentsPerWindow = 10;
    private static readonly TimeSpan CommentWindow = TimeSpan.FromMinutes(10);

    public static async Task<CommentPageResponse> PageAsync(
        AppDbContext db,
        IMediaStore media,
        IQueryable<Comment> thread,
        Guid? before,
        Func<Guid, bool> canDelete,
        CancellationToken cancellationToken)
    {
        if (before is { } cursor)
        {
            thread = thread.Where(comment => comment.Id.CompareTo(cursor) < 0);
        }

        var rows = await thread
            .Join(db.Users.Where(author => author.IsEnabled), comment => comment.AuthorId, author => author.Id, (comment, author) => new
            {
                comment.Id,
                comment.AuthorId,
                author.Username,
                AuthorJoinedAt = author.CreatedAt,
                author.AvatarKey,
                comment.Body,
                comment.CreatedAt,
            })
            .OrderByDescending(row => row.Id)
            .Take(PageSize + 1)
            .ToListAsync(cancellationToken);

        var page = rows.Take(PageSize)
            .Select(row => new CommentResponse(
                row.Id,
                row.Username,
                row.AuthorJoinedAt,
                AvatarImages.Urls(media, row.AvatarKey),
                row.Body,
                row.CreatedAt,
                canDelete(row.AuthorId)))
            .ToArray();

        return new CommentPageResponse(page, rows.Count > PageSize ? page[^1].Id : null);
    }

    // Null when this account may comment right now.
    public static ProblemHttpResult? RefusePoster(User author, DateTimeOffset now)
    {
        if (!author.CanCollectAchievements)
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "email_required", "Add and confirm an email to comment");
        }

        return author.IsMutedAt(now)
            ? AccountProblems.Create(StatusCodes.Status403Forbidden, "account_muted", "This account is muted")
            : null;
    }

    public static async Task<bool> PostedTooOftenAsync(AppDbContext db, Guid authorId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var since = now - CommentWindow;
        return await db.Comments.CountAsync(comment => comment.AuthorId == authorId && comment.CreatedAt > since, cancellationToken) >= MaxCommentsPerWindow;
    }

    public static ProblemHttpResult TooManyRequests() =>
        TypedResults.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many requests");

    public static CommentResponse Created(Comment comment, User author, IMediaStore media) =>
        new(comment.Id, author.Username, author.CreatedAt, AvatarImages.Urls(media, author.AvatarKey), comment.Body, comment.CreatedAt, true);
}
