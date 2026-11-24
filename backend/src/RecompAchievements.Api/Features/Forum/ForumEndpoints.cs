using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Games;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Forum;

/** The forum. Anyone reads published posts. Managing posts is for admins only: those endpoints
 *  re-read the role from the database on every request and answer 404 to everyone else, so they
 *  can't be discovered. The API stores Markdown source and never renders HTML.
**/
internal static class ForumEndpoints
{
    private const int PageSize = 25;
    private const int RecentCount = 5;
    private const int MaxPage = 10_000;

    public static RouteGroupBuilder MapForumEndpoints(this RouteGroupBuilder api)
    {
        var forum = api.MapGroup("/forum").WithTags("Forum");
        forum.MapGet("/categories", ListCategoriesAsync).WithSummary("Forum categories with their latest published post");
        forum.MapGet("/{category}/posts", ListPublishedAsync).WithSummary("One numbered page of a category's published posts");
        forum.MapGet("/{category}/posts/{slug}", GetPublishedAsync).WithSummary("One published post");

        var admin = api.MapGroup("/forum-admin/{category}/posts").WithTags("Forum");
        admin.AddEndpointFilter(RequireAdminAsync);
        admin.MapGet("/", ListAllAsync).WithSummary("Admin: every post in a category, drafts included");
        admin.MapGet("/{slug}", GetSourceAsync).WithSummary("Admin: a post's source in every language");
        admin.MapPost("/", CreateAsync).RequireRateLimiting(RateLimiting.ForumPolicy).WithSummary("Admin: create a post");
        admin.MapPut("/{slug}", UpdateAsync).RequireRateLimiting(RateLimiting.ForumPolicy).WithSummary("Admin: update, publish, or unpublish a post");
        admin.MapDelete("/{slug}", DeleteAsync).RequireRateLimiting(RateLimiting.ForumPolicy).WithSummary("Admin: delete a post");

        return api;
    }

    private static async ValueTask<object?> RequireAdminAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var http = invocation.HttpContext;
        var sessions = http.RequestServices.GetRequiredService<Sessions>();
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        if (await sessions.ResolveAsync(http, http.RequestAborted) is not { } session
            || !await db.Users.AnyAsync(u => u.Id == session.UserId && u.Role == UserRoles.Admin, http.RequestAborted))
        {
            return TypedResults.NotFound();
        }

        http.Items[nameof(ForumEndpoints)] = session.UserId;
        return await next(invocation);
    }

    private static async Task<Ok<ForumCategoryResponse[]>> ListCategoriesAsync(
        AppDbContext db,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en")
    {
        var categories = await db.ForumCategories.OrderBy(c => c.DisplayOrder).ThenBy(c => c.Key).ToListAsync(cancellationToken);
        var responses = new List<ForumCategoryResponse>();
        foreach (var category in categories)
        {
            responses.Add(await CategoryResponseAsync(db, category, lang, cancellationToken));
        }

        return TypedResults.Ok(responses.ToArray());
    }

    private static async Task<Results<Ok<ForumPostPageResponse>, NotFound, ValidationProblem>> ListPublishedAsync(
        string category,
        int? page,
        AppDbContext db,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en") =>
        await PageAsync(db, category, page, lang, publishedOnly: true, cancellationToken);

    private static async Task<Results<Ok<ForumPostPageResponse>, NotFound, ValidationProblem>> ListAllAsync(
        string category,
        int? page,
        AppDbContext db,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en") =>
        await PageAsync(db, category, page, lang, publishedOnly: false, cancellationToken);

    private static async Task<Results<Ok<ForumPostResponse>, NotFound>> GetPublishedAsync(
        string category,
        string slug,
        AppDbContext db,
        IMediaStore media,
        CancellationToken cancellationToken,
        [AllowedValues("en", "es", "pt")] string lang = "en")
    {
        var found = await db.ForumCategories.FirstOrDefaultAsync(c => c.Key == category, cancellationToken);
        if (found is null)
        {
            return TypedResults.NotFound();
        }

        var post = await db.ForumPosts.FirstOrDefaultAsync(
            p => p.CategoryId == found.Id && p.Slug == slug && p.Status == ForumPostStatus.Published, cancellationToken);
        if (post is null)
        {
            return TypedResults.NotFound();
        }

        var author = post.AuthorId is { } authorId
            ? await db.Users.Where(u => u.Id == authorId).Select(u => new { u.Username, u.AvatarKey }).FirstOrDefaultAsync(cancellationToken)
            : null;
        string[] languages = ["en", .. new[] { ("es", post.Body.Es), ("pt", post.Body.Pt) }.Where(pair => pair.Item2 is not null).Select(pair => pair.Item1)];
        var body = post.Body.For(lang);

        return TypedResults.Ok(new ForumPostResponse(
            found.Key,
            found.Name.For(lang),
            found.CommentsEnabled,
            post.Slug,
            post.Title.For(lang),
            body,
            ForumText.Excerpt(body),
            languages,
            post.Status,
            author?.Username,
            AvatarImages.Urls(media, author?.AvatarKey),
            post.CreatedAt,
            post.PublishedAt,
            post.EditedAt));
    }

    private static async Task<Results<Ok<ForumPostSourceResponse>, NotFound>> GetSourceAsync(
        string category,
        string slug,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var post = await FindPostAsync(db.ForumPosts, db, category, slug, cancellationToken);
        return post is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(new ForumPostSourceResponse(
                post.Slug,
                new ForumTextInput(post.Title.En, post.Title.Es, post.Title.Pt),
                new ForumTextInput(post.Body.En, post.Body.Es, post.Body.Pt),
                post.Status,
                post.PinnedAt != null,
                post.PublishedAt));
    }

    private static async Task<Results<Created<ForumPostSourceResponse>, NotFound, ProblemHttpResult>> CreateAsync(
        string category,
        SaveForumPostRequest request,
        HttpContext context,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var found = await db.ForumCategories.FirstOrDefaultAsync(c => c.Key == category, cancellationToken);
        if (found is null)
        {
            return TypedResults.NotFound();
        }

        var now = time.GetUtcNow();
        var post = new ForumPost
        {
            CategoryId = found.Id,
            Slug = request.Slug,
            Title = ForumText.Clean(request.Title, singleLine: true),
            Body = ForumText.Clean(request.Body, singleLine: false),
            Status = request.Status,
            AuthorId = (Guid)context.Items[nameof(ForumEndpoints)]!,
            CreatedAt = now,
            PublishedAt = request.Status == ForumPostStatus.Published ? now : null,
            PinnedAt = request.Pinned ? now : null,
        };
        db.ForumPosts.Add(post);
        if (!await TrySaveAsync(db, cancellationToken))
        {
            return SlugTaken();
        }

        return TypedResults.Created($"/api/v1/forum/{found.Key}/posts/{post.Slug}", Source(post));
    }

    private static async Task<Results<Ok<ForumPostSourceResponse>, NotFound, ProblemHttpResult>> UpdateAsync(
        string category,
        string slug,
        SaveForumPostRequest request,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var post = await FindPostAsync(db.ForumPosts.AsTracking(), db, category, slug, cancellationToken);
        if (post is null)
        {
            return TypedResults.NotFound();
        }

        // Once a post has been public its address is fixed, because links to it are shared.
        if (post.PublishedAt is not null && request.Slug != post.Slug)
        {
            return AccountProblems.Create(StatusCodes.Status409Conflict, "slug_locked", "A published post's address can't change");
        }

        var now = time.GetUtcNow();
        var wasPublic = post.PublishedAt is not null;
        post.Slug = request.Slug;
        post.Title = ForumText.Clean(request.Title, singleLine: true);
        post.Body = ForumText.Clean(request.Body, singleLine: false);
        post.Status = request.Status;
        // Keeps the original pin time, so re-saving a pinned post doesn't reorder the pins.
        post.PinnedAt = request.Pinned ? post.PinnedAt ?? now : null;
        if (request.Status == ForumPostStatus.Published && post.PublishedAt is null)
        {
            post.PublishedAt = now;
        }
        else if (wasPublic)
        {
            post.EditedAt = now;
        }

        return await TrySaveAsync(db, cancellationToken) ? TypedResults.Ok(Source(post)) : SlugTaken();
    }

    private static async Task<Results<NoContent, NotFound>> DeleteAsync(
        string category,
        string slug,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var categoryId = await db.ForumCategories.Where(c => c.Key == category).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(cancellationToken);
        var deleted = categoryId is null
            ? 0
            : await db.ForumPosts.Where(p => p.CategoryId == categoryId && p.Slug == slug).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static async Task<Results<Ok<ForumPostPageResponse>, NotFound, ValidationProblem>> PageAsync(
        AppDbContext db,
        string category,
        int? page,
        string lang,
        bool publishedOnly,
        CancellationToken cancellationToken)
    {
        var number = page ?? 1;
        if (number is < 1 or > MaxPage)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["page"] = [$"Use a page from 1 to {MaxPage}."] });
        }

        var found = await db.ForumCategories.FirstOrDefaultAsync(c => c.Key == category, cancellationToken);
        if (found is null)
        {
            return TypedResults.NotFound();
        }

        var posts = db.ForumPosts.Where(p => p.CategoryId == found.Id);
        if (publishedOnly)
        {
            posts = posts.Where(p => p.Status == ForumPostStatus.Published);
        }

        var total = await posts.CountAsync(cancellationToken);
        var rows = await posts
            .OrderByDescending(p => p.PublishedAt == null)
            .ThenByDescending(p => p.PublishedAt)
            .ThenByDescending(p => p.CreatedAt)
            .Skip((number - 1) * PageSize)
            .Take(PageSize)
            .Select(p => new { Post = p, Author = db.Users.Where(u => u.Id == p.AuthorId).Select(u => u.Username).FirstOrDefault() })
            .ToListAsync(cancellationToken);

        return TypedResults.Ok(new ForumPostPageResponse(
            await CategoryResponseAsync(db, found, lang, cancellationToken),
            [.. rows.Select(row => Summary(row.Post, row.Author, lang))],
            number,
            PageSize,
            total,
            (total + PageSize - 1) / PageSize));
    }

    private static async Task<ForumCategoryResponse> CategoryResponseAsync(AppDbContext db, ForumCategory category, string lang, CancellationToken cancellationToken)
    {
        var published = db.ForumPosts.Where(p => p.CategoryId == category.Id && p.Status == ForumPostStatus.Published);
        var count = await published.CountAsync(cancellationToken);
        var pinned = await published
            .Where(p => p.PinnedAt != null)
            .OrderByDescending(p => p.PinnedAt)
            .Select(p => new { Post = p, Author = db.Users.Where(u => u.Id == p.AuthorId).Select(u => u.Username).FirstOrDefault() })
            .ToListAsync(cancellationToken);
        var recent = await published
            .OrderByDescending(p => p.PublishedAt)
            .Take(RecentCount)
            .Select(p => new { Post = p, Author = db.Users.Where(u => u.Id == p.AuthorId).Select(u => u.Username).FirstOrDefault() })
            .ToListAsync(cancellationToken);
        return new ForumCategoryResponse(
            category.Key,
            category.Name.For(lang),
            category.Description.For(lang),
            category.AdminOnly,
            category.CommentsEnabled,
            count,
            [.. pinned.Select(row => Summary(row.Post, row.Author, lang))],
            [.. recent.Select(row => Summary(row.Post, row.Author, lang))]);
    }

    private static ForumPostSummaryResponse Summary(ForumPost post, string? author, string lang) =>
        new(post.Slug, post.Title.For(lang), ForumText.Excerpt(post.Body.For(lang)), post.Status, post.PinnedAt != null, author, post.PublishedAt, post.CreatedAt);

    private static ForumPostSourceResponse Source(ForumPost post) =>
        new(post.Slug, new ForumTextInput(post.Title.En, post.Title.Es, post.Title.Pt), new ForumTextInput(post.Body.En, post.Body.Es, post.Body.Pt), post.Status, post.PinnedAt != null, post.PublishedAt);

    private static async Task<ForumPost?> FindPostAsync(IQueryable<ForumPost> posts, AppDbContext db, string category, string slug, CancellationToken cancellationToken)
    {
        var categoryId = await db.ForumCategories.Where(c => c.Key == category).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(cancellationToken);
        return categoryId is null ? null : await posts.FirstOrDefaultAsync(p => p.CategoryId == categoryId && p.Slug == slug, cancellationToken);
    }

    private static async Task<bool> TrySaveAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }

    private static ProblemHttpResult SlugTaken() =>
        AccountProblems.Create(StatusCodes.Status409Conflict, "slug_taken", "Another post in this category uses that address");
}
