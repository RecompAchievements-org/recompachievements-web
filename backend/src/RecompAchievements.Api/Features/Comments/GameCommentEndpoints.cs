using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Comments;

/** Comments on a game page. Anyone can read them; the shared CommentThreads rules decide who posts;
 *  only a comment's author deletes it here, and staff remove others through moderation.
**/
internal static class GameCommentEndpoints
{
    public static RouteGroupBuilder MapGameCommentEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/games/{slug}/comments").WithTags("Comments");

        group.MapGet("/", ListAsync).WithSummary("One numbered page of a game's comments, newest first");
        group.MapPost("/", CreateAsync)
            .RequireRateLimiting(RateLimiting.CommentPolicy)
            .WithSummary("Post a comment on a game page");
        group.MapDelete("/{id:guid}", DeleteAsync)
            .RequireRateLimiting(RateLimiting.CommentPolicy)
            .WithSummary("Delete your own comment on a game page");

        return api;
    }

    private static async Task<Results<Ok<CommentPageResponse>, NotFound, ValidationProblem>> ListAsync(
        string slug,
        int? page,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        CancellationToken cancellationToken)
    {
        var number = page ?? 1;
        if (!CommentThreads.IsValidPage(number))
        {
            return CommentThreads.InvalidPage();
        }

        if (await GameIdAsync(db, slug, cancellationToken) is not { } gameId)
        {
            return TypedResults.NotFound();
        }

        var viewerId = (await sessions.ResolveAsync(context, cancellationToken))?.UserId;
        var result = await CommentThreads.PageAsync(
            db,
            media,
            db.Comments.Where(comment => comment.GameId == gameId),
            number,
            authorId => viewerId == authorId,
            cancellationToken);
        return TypedResults.Ok(result);
    }

    private static async Task<Results<Created<CommentResponse>, NotFound, ProblemHttpResult>> CreateAsync(
        string slug,
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

        if (await GameIdAsync(db, slug, cancellationToken) is not { } gameId)
        {
            return TypedResults.NotFound();
        }

        if (await CommentThreads.PostedTooOftenAsync(db, author.Id, now, cancellationToken))
        {
            return CommentThreads.TooManyRequests();
        }

        var comment = new Comment { GameId = gameId, AuthorId = author.Id, Body = CommentText.Clean(request.Body), CreatedAt = now };
        db.Comments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Created(
            $"/api/v1/games/{Uri.EscapeDataString(slug)}/comments/{comment.Id}",
            CommentThreads.Created(comment, author, media));
    }

    // Anything the viewer can't delete answers 404, so it reveals nothing about the comment.
    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
        string slug,
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

        if (await GameIdAsync(db, slug, cancellationToken) is not { } gameId)
        {
            return TypedResults.NotFound();
        }

        var deleted = await db.Comments
            .Where(comment => comment.Id == id && comment.GameId == gameId && comment.AuthorId == session.UserId)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static Task<Guid?> GameIdAsync(AppDbContext db, string slug, CancellationToken cancellationToken) =>
        db.Games.Where(game => game.Slug == slug).Select(game => (Guid?)game.Id).FirstOrDefaultAsync(cancellationToken);
}
