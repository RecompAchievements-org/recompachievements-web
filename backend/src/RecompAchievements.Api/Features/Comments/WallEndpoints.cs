using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Comments;

/** The comment wall on a player's public profile. Anyone can read it; the shared CommentThreads rules
 *  decide who posts; a comment's author or the wall's owner can delete it. A wall exists only for
 *  a publicly visible player.
**/
internal static class WallEndpoints
{
    public static RouteGroupBuilder MapWallEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/users/{username}/wall").WithTags("Comments");

        group.MapGet("/", ListAsync).WithSummary("A page of a player's wall comments, newest first");
        group.MapPost("/", CreateAsync)
            .RequireRateLimiting(RateLimiting.CommentPolicy)
            .WithSummary("Post a comment on a player's wall");
        group.MapDelete("/{id:guid}", DeleteAsync)
            .RequireRateLimiting(RateLimiting.CommentPolicy)
            .WithSummary("Delete a comment (its author or the wall's owner)");

        return api;
    }

    private static async Task<Results<Ok<CommentPageResponse>, NotFound>> ListAsync(
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
        var page = await CommentThreads.PageAsync(
            db,
            media,
            db.Comments.Where(comment => comment.WallUserId == wallId),
            before,
            authorId => viewerId is { } viewer && (viewer == authorId || viewer == wallId),
            cancellationToken);
        return TypedResults.Ok(page);
    }

    private static async Task<Results<Created<CommentResponse>, NotFound, ProblemHttpResult>> CreateAsync(
        string username,
        CreateCommentRequest request,
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
        var now = time.GetUtcNow();
        if (CommentThreads.RefusePoster(author, now) is { } refused)
        {
            return refused;
        }

        if (await WallIdAsync(db, username, cancellationToken) is not { } wallId)
        {
            return TypedResults.NotFound();
        }

        if (await CommentThreads.PostedTooOftenAsync(db, author.Id, now, cancellationToken))
        {
            return CommentThreads.TooManyRequests();
        }

        var comment = new Comment { WallUserId = wallId, AuthorId = author.Id, Body = CommentText.Clean(request.Body), CreatedAt = now };
        db.Comments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/v1/users/{Uri.EscapeDataString(username)}/wall/{comment.Id}",
            CommentThreads.Created(comment, author, media));
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

        var deleted = await db.Comments
            .Where(comment => comment.Id == id && comment.WallUserId == wallId
                && (comment.AuthorId == session.UserId || wallId == session.UserId))
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static Task<Guid?> WallIdAsync(AppDbContext db, string username, CancellationToken cancellationToken) =>
        db.Users.PublicByUsername(username).Select(user => (Guid?)user.Id).FirstOrDefaultAsync(cancellationToken);
}
