using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Walls;

/** The comment wall on a player's public profile. Anyone can read it; enabled accounts with a
 *  confirmed email can post; a comment's author or the wall's owner can delete it. Comments from
 *  disabled accounts are hidden, and a wall exists only for a publicly visible player.
**/
internal static class WallEndpoints
{
    private const int PageSize = 20;
    private const int MaxCommentsPerWindow = 10;
    private static readonly TimeSpan CommentWindow = TimeSpan.FromMinutes(10);

    public static RouteGroupBuilder MapWallEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/users/{username}/wall").WithTags("Walls");

        group.MapGet("/", ListAsync).WithSummary("A page of a player's wall comments, newest first");
        group.MapPost("/", CreateAsync)
            .RequireRateLimiting(RateLimiting.WallPolicy)
            .WithSummary("Post a comment on a player's wall");
        group.MapDelete("/{id:guid}", DeleteAsync)
            .RequireRateLimiting(RateLimiting.WallPolicy)
            .WithSummary("Delete a comment (its author or the wall's owner)");

        return api;
    }

    private static async Task<Results<Ok<WallPageResponse>, NotFound>> ListAsync(
        string username,
        Guid? before,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        CancellationToken cancellationToken)
    {
        if (await WallIdAsync(db, username, cancellationToken) is not { } wallId)
        {
            return TypedResults.NotFound();
        }

        var viewerId = (await sessions.ResolveAsync(context, cancellationToken))?.UserId;
        var comments = db.WallComments.Where(comment => comment.WallUserId == wallId);
        if (before is { } cursor)
        {
            comments = comments.Where(comment => comment.Id.CompareTo(cursor) < 0);
        }

        var rows = await comments
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
            .Select(row => new WallCommentResponse(
                row.Id,
                row.Username,
                row.AuthorJoinedAt,
                AvatarImages.Urls(media, row.AvatarKey),
                row.Body,
                row.CreatedAt,
                viewerId is { } viewer && (viewer == row.AuthorId || viewer == wallId)))
            .ToArray();

        return TypedResults.Ok(new WallPageResponse(page, rows.Count > PageSize ? page[^1].Id : null));
    }

    private static async Task<Results<Created<WallCommentResponse>, NotFound, ProblemHttpResult>> CreateAsync(
        string username,
        CreateWallCommentRequest request,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        TimeProvider time,
        IMediaStore media,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var author = await db.Users.SingleAsync(user => user.Id == session.UserId, cancellationToken);
        if (!author.CanCollectAchievements)
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "email_required", "Add and confirm an email to comment");
        }

        if (author.IsMutedAt(time.GetUtcNow()))
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "account_muted", "This account is muted");
        }

        if (await WallIdAsync(db, username, cancellationToken) is not { } wallId)
        {
            return TypedResults.NotFound();
        }

        var now = time.GetUtcNow();
        var since = now - CommentWindow;
        var recent = await db.WallComments.CountAsync(comment => comment.AuthorId == author.Id && comment.CreatedAt > since, cancellationToken);
        if (recent >= MaxCommentsPerWindow)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many requests");
        }

        var comment = new WallComment { WallUserId = wallId, AuthorId = author.Id, Body = WallText.Clean(request.Body), CreatedAt = now };
        db.WallComments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/v1/users/{Uri.EscapeDataString(username)}/wall/{comment.Id}",
            new WallCommentResponse(comment.Id, author.Username, author.CreatedAt, AvatarImages.Urls(media, author.AvatarKey), comment.Body, comment.CreatedAt, true));
    }

    // Anything the viewer can't delete answers 404, so it reveals nothing about the comment.
    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
        string username,
        Guid id,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        if (await WallIdAsync(db, username, cancellationToken) is not { } wallId)
        {
            return TypedResults.NotFound();
        }

        var deleted = await db.WallComments
            .Where(comment => comment.Id == id && comment.WallUserId == wallId
                && (comment.AuthorId == session.UserId || wallId == session.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static Task<Guid?> WallIdAsync(AppDbContext db, string username, CancellationToken cancellationToken) =>
        db.Users.PublicByUsername(username).Select(user => (Guid?)user.Id).FirstOrDefaultAsync(cancellationToken);
}
