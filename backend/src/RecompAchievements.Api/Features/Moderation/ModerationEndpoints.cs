using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Moderation;

internal sealed record StaffMember(Guid Id, string Role)
{
    public bool IsAdmin => Role == UserRoles.Admin;

    // Nobody acts on themselves; moderators act only on players, and admins on anyone else.
    public bool CanActOn(Guid targetId, string targetRole) => targetId != Id && (IsAdmin || targetRole == UserRoles.Player);
}

/** Player reports and the staff tools. Staff endpoints re-read the role from the database on every
 *  request and answer 404 to everyone else, so they can't be discovered. Each change and its audit
 *  entry commit together; emails and file cleanup happen only after that commit.
**/
internal static partial class ModerationEndpoints
{
    private const string StaffKey = "moderation-staff";
    private const int PageSize = 25;
    private const int RecentActionCount = 10;
    private const int MaxReportsPerWindow = 20;
    private static readonly TimeSpan ReportWindow = TimeSpan.FromHours(1);

    public static RouteGroupBuilder MapModerationEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/reports", CreateReportAsync)
            .WithTags("Moderation")
            .RequireRateLimiting(RateLimiting.ReportPolicy)
            .WithSummary("Report a profile, photo, or wall comment");

        var staff = api.MapGroup("/moderation").WithTags("Moderation");
        staff.AddEndpointFilter(RequireStaffAsync);

        staff.MapGet("/reports", ListReportsAsync).WithSummary("A page of reports, newest first");
        staff.MapGet("/reports/{id:guid}", GetReportAsync).WithSummary("One report with its target");
        staff.MapGet("/users/{username}", GetUserAsync).WithSummary("An account's moderation summary");
        staff.MapGet("/log", ListLogAsync).WithSummary("A page of the audit log, newest first");

        var writes = staff.MapGroup("/").RequireRateLimiting(RateLimiting.ModerationPolicy);
        writes.MapPost("/reports/{id:guid}/resolve", (Guid id, ModerationReasonRequest request, HttpContext context, AppDbContext db, AccountLinks links, TimeProvider time, CancellationToken ct) =>
            CloseReportAsync(id, ReportStatuses.Resolved, request, context, db, links, time, ct)).WithSummary("Close a report as handled");
        writes.MapPost("/reports/{id:guid}/dismiss", (Guid id, ModerationReasonRequest request, HttpContext context, AppDbContext db, AccountLinks links, TimeProvider time, CancellationToken ct) =>
            CloseReportAsync(id, ReportStatuses.Dismissed, request, context, db, links, time, ct)).WithSummary("Close a report with no violation");
        writes.MapPost("/comments/{id:guid}/remove", RemoveCommentAsync).WithSummary("Remove a wall comment");
        writes.MapPost("/users/{username}/photo/remove", RemovePhotoAsync).WithSummary("Remove a player's photo");
        writes.MapPost("/users/{username}/photo/legal-hold", LegalHoldAsync).WithSummary("Admin: unpublish serious illegal content and preserve it");
        writes.MapPost("/users/{username}/mute", MuteAsync).WithSummary("Mute an account until a date");
        writes.MapPost("/users/{username}/unmute", UnmuteAsync).WithSummary("End a mute");
        writes.MapPost("/users/{username}/disable", DisableAsync).WithSummary("Disable an account");
        writes.MapPost("/users/{username}/enable", EnableAsync).WithSummary("Enable an account again");
        writes.MapPut("/users/{username}/role", ChangeRoleAsync).WithSummary("Admin: change an account's role");

        return api;
    }

    private static async ValueTask<object?> RequireStaffAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var http = invocation.HttpContext;
        var sessions = http.RequestServices.GetRequiredService<Sessions>();
        var db = http.RequestServices.GetRequiredService<AppDbContext>();
        if (await sessions.ResolveAsync(http, http.RequestAborted) is not { } session)
        {
            return TypedResults.NotFound();
        }

        var role = await db.Users.Where(u => u.Id == session.UserId).Select(u => u.Role).FirstOrDefaultAsync(http.RequestAborted);
        if (role is not (UserRoles.Moderator or UserRoles.Admin))
        {
            return TypedResults.NotFound();
        }

        http.Items[StaffKey] = new StaffMember(session.UserId, role);
        return await next(invocation);
    }

    private static StaffMember Staff(HttpContext context) => (StaffMember)context.Items[StaffKey]!;

    private static ProblemHttpResult NotPermitted() =>
        AccountProblems.Create(StatusCodes.Status403Forbidden, "moderation_forbidden", "You can't act on this account");

    private static async Task<Results<Accepted<AcceptedResponse>, NotFound, ProblemHttpResult>> CreateReportAsync(
        CreateReportRequest request,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var target = await db.Users.PublicByUsername(request.TargetUsername)
            .Select(u => new { u.Id, u.AvatarKey })
            .FirstOrDefaultAsync(cancellationToken);
        if (target is null)
        {
            return TypedResults.NotFound();
        }

        if (target.Id == session.UserId)
        {
            return AccountProblems.Create(StatusCodes.Status400BadRequest, "cannot_report_self", "You can't report your own content");
        }

        string targetKey;
        string? snapshot = null;
        switch (request.TargetType)
        {
            case ReportTargets.WallComment:
                var comment = await db.WallComments
                    .Where(c => c.Id == request.CommentId && c.AuthorId == target.Id)
                    .Select(c => new { c.Id, c.Body })
                    .FirstOrDefaultAsync(cancellationToken);
                if (comment is null)
                {
                    return TypedResults.NotFound();
                }

                (targetKey, snapshot) = (comment.Id.ToString(), comment.Body);
                break;
            case ReportTargets.Photo:
                if (target.AvatarKey is null)
                {
                    return TypedResults.NotFound();
                }

                targetKey = target.AvatarKey;
                break;
            default:
                targetKey = target.Id.ToString();
                break;
        }

        var accepted = TypedResults.Accepted((string?)null, new AcceptedResponse("received"));
        var alreadyOpen = await db.ModerationReports.AnyAsync(
            r => r.ReporterId == session.UserId && r.TargetType == request.TargetType && r.TargetKey == targetKey && r.Status == ReportStatuses.Open,
            cancellationToken);
        if (alreadyOpen)
        {
            return accepted;
        }

        var now = time.GetUtcNow();
        var since = now - ReportWindow;
        if (await db.ModerationReports.CountAsync(r => r.ReporterId == session.UserId && r.CreatedAt > since, cancellationToken) >= MaxReportsPerWindow)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many requests");
        }

        db.ModerationReports.Add(new ModerationReport
        {
            ReporterId = session.UserId,
            ReportedUserId = target.Id,
            TargetType = request.TargetType,
            TargetKey = targetKey,
            Reason = request.Reason,
            Details = ModerationText.Clean(request.Details),
            Snapshot = snapshot,
            CreatedAt = now,
        });

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The same report arrived twice at once; the first one stands.
        }

        return accepted;
    }

    private static async Task<Ok<ReportPageResponse>> ListReportsAsync(
        string? status,
        Guid? before,
        AppDbContext db,
        CancellationToken cancellationToken)
    {
        var wanted = status is ReportStatuses.Resolved or ReportStatuses.Dismissed ? status : ReportStatuses.Open;
        var reports = db.ModerationReports.Where(r => r.Status == wanted);
        if (before is { } cursor)
        {
            reports = reports.Where(r => r.Id.CompareTo(cursor) < 0);
        }

        var rows = await Summaries(db, reports.OrderByDescending(r => r.Id).Take(PageSize + 1)).ToListAsync(cancellationToken);
        var page = rows.Take(PageSize).ToArray();
        return TypedResults.Ok(new ReportPageResponse(page, rows.Count > PageSize ? page[^1].Id : null));
    }

    private static IQueryable<ReportSummaryResponse> Summaries(AppDbContext db, IQueryable<ModerationReport> reports) =>
        reports.Select(r => new ReportSummaryResponse(
            r.Id,
            r.TargetType,
            r.Reason,
            r.Status,
            db.Users.Where(u => u.Id == r.ReporterId).Select(u => u.Username).FirstOrDefault(),
            db.Users.Where(u => u.Id == r.ReportedUserId).Select(u => u.Username).FirstOrDefault(),
            r.Details,
            r.CreatedAt));

    private static async Task<Results<Ok<ReportDetailResponse>, NotFound>> GetReportAsync(
        Guid id,
        AppDbContext db,
        IMediaStore media,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var report = await db.ModerationReports.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (report is null)
        {
            return TypedResults.NotFound();
        }

        var summary = await Summaries(db, db.ModerationReports.Where(r => r.Id == id)).SingleAsync(cancellationToken);
        var reported = await db.Users.FirstOrDefaultAsync(u => u.Id == report.ReportedUserId, cancellationToken);
        var stillExists = report.TargetType switch
        {
            ReportTargets.WallComment => Guid.TryParse(report.TargetKey, out var commentId)
                && await db.WallComments.AnyAsync(c => c.Id == commentId, cancellationToken),
            ReportTargets.Photo => reported?.AvatarKey == report.TargetKey,
            _ => reported is not null,
        };
        var resolver = report.ResolvedById is { } resolverId
            ? await db.Users.Where(u => u.Id == resolverId).Select(u => u.Username).FirstOrDefaultAsync(cancellationToken)
            : null;

        return TypedResults.Ok(new ReportDetailResponse(
            summary,
            report.TargetKey,
            report.Snapshot,
            stillExists,
            resolver,
            report.ResolvedAt,
            report.ResolutionNote,
            reported is null ? null : await UserSummaryAsync(db, media, time, reported, cancellationToken)));
    }

    private static async Task<Results<Ok<ModerationUserResponse>, NotFound>> GetUserAsync(
        string username,
        AppDbContext db,
        IMediaStore media,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var user = await FindAsync(db.Users, username, cancellationToken);
        return user is null ? TypedResults.NotFound() : TypedResults.Ok(await UserSummaryAsync(db, media, time, user, cancellationToken));
    }

    private static async Task<ModerationUserResponse> UserSummaryAsync(AppDbContext db, IMediaStore media, TimeProvider time, User user, CancellationToken cancellationToken)
    {
        var openReports = await db.ModerationReports.CountAsync(r => r.ReportedUserId == user.Id && r.Status == ReportStatuses.Open, cancellationToken);
        var actions = await ActionResponses(db, db.ModerationActions.Where(a => a.TargetUserId == user.Id).OrderByDescending(a => a.Id).Take(RecentActionCount))
            .ToArrayAsync(cancellationToken);
        return new ModerationUserResponse(
            user.Username,
            user.Role,
            user.IsEnabled,
            user.IsMutedAt(time.GetUtcNow()),
            user.MutedUntil,
            user.CreatedAt,
            user.LastActivityAt,
            AvatarImages.Urls(media, user.AvatarKey),
            openReports,
            actions);
    }

    private static async Task<Ok<ModerationActionPageResponse>> ListLogAsync(Guid? before, AppDbContext db, CancellationToken cancellationToken)
    {
        var actions = db.ModerationActions.AsQueryable();
        if (before is { } cursor)
        {
            actions = actions.Where(a => a.Id.CompareTo(cursor) < 0);
        }

        var rows = await ActionResponses(db, actions.OrderByDescending(a => a.Id).Take(PageSize + 1)).ToListAsync(cancellationToken);
        var page = rows.Take(PageSize).ToArray();
        return TypedResults.Ok(new ModerationActionPageResponse(page, rows.Count > PageSize ? page[^1].Id : null));
    }

    // A legal hold's evidence location is never shown in any staff screen.
    private static IQueryable<ModerationActionResponse> ActionResponses(AppDbContext db, IQueryable<ModerationAction> actions) =>
        actions.Select(a => new ModerationActionResponse(
            a.Id,
            db.Users.Where(u => u.Id == a.ModeratorId).Select(u => u.Username).FirstOrDefault(),
            db.Users.Where(u => u.Id == a.TargetUserId).Select(u => u.Username).FirstOrDefault(),
            a.Action,
            a.Reason,
            a.Action == ModerationActionKinds.LegalHold ? null : a.Evidence,
            a.ExpiresAt,
            a.CreatedAt));

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> CloseReportAsync(
        Guid id,
        string status,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        AccountLinks links,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var report = await db.ModerationReports.FirstOrDefaultAsync(r => r.Id == id && r.Status == ReportStatuses.Open, cancellationToken);
        if (report is null)
        {
            return TypedResults.NotFound();
        }

        var reportedRole = await db.Users.Where(u => u.Id == report.ReportedUserId).Select(u => u.Role).FirstOrDefaultAsync(cancellationToken);
        if (reportedRole is not null && !staff.CanActOn(report.ReportedUserId, reportedRole))
        {
            return NotPermitted();
        }

        var kind = status == ReportStatuses.Resolved ? ModerationActionKinds.ResolveReport : ModerationActionKinds.DismissReport;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = time.GetUtcNow();
        var reason = WallTextClean(request.Reason);
        db.ModerationActions.Add(new ModerationAction { ModeratorId = staff.Id, TargetUserId = report.ReportedUserId, Action = kind, ReportId = id, Reason = reason, CreatedAt = now });
        await db.SaveChangesAsync(cancellationToken);
        await db.ModerationReports.Where(r => r.Id == id).ExecuteUpdateAsync(set => set
            .SetProperty(r => r.Status, status)
            .SetProperty(r => r.ResolvedById, staff.Id)
            .SetProperty(r => r.ResolvedAt, now)
            .SetProperty(r => r.ResolutionNote, reason), cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var outcome = status == ReportStatuses.Resolved ? AccountEmailKind.ReportActioned : AccountEmailKind.ReportDismissed;
        await NotifyReportersAsync(db, links, [report.ReporterId], outcome, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse(status, true));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> RemoveCommentAsync(
        Guid id,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        AccountLinks links,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var comment = await db.WallComments.AsTracking().FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (comment is null)
        {
            return TypedResults.NotFound();
        }

        var author = await db.Users.SingleAsync(u => u.Id == comment.AuthorId, cancellationToken);
        if (!staff.CanActOn(author.Id, author.Role))
        {
            return NotPermitted();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.WallComments.Remove(comment);
        var reporters = await RecordAsync(db, time, staff, author.Id, ModerationActionKinds.RemoveComment, request.Reason, request.ReportId, ReportTargets.WallComment, id.ToString(), comment.Body, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await links.SendModerationNoticeAsync(author, AccountEmailKind.ContentRemoved, WallTextClean(request.Reason), null, cancellationToken);
        await NotifyReportersAsync(db, links, reporters, AccountEmailKind.ReportActioned, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("removed", true));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> RemovePhotoAsync(
        string username,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        AccountLinks links,
        IMediaStore media,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user?.AvatarKey is not { } prefix)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.AvatarKey = null;
        var reporters = await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.RemovePhoto, request.Reason, request.ReportId, ReportTargets.Photo, prefix, null, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var purged = await PhotoEndpoints.RemoveFilesAsync(media, prefix, loggers.CreateLogger(nameof(ModerationEndpoints)), cancellationToken);
        await links.SendModerationNoticeAsync(user, AccountEmailKind.ContentRemoved, WallTextClean(request.Reason), null, cancellationToken);
        await NotifyReportersAsync(db, links, reporters, AccountEmailKind.ReportActioned, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("removed", purged));
    }

    /** For serious illegal content: keeps a private copy for legally required reporting, then takes
     *  the image down and disables the account. The account owner is deliberately not emailed.
    **/
    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> LegalHoldAsync(
        string username,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        if (!staff.IsAdmin)
        {
            return NotPermitted();
        }

        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user?.AvatarKey is not { } prefix)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        var logger = loggers.CreateLogger(nameof(ModerationEndpoints));
        var evidenceKey = $"evidence/{Guid.CreateVersion7():N}.webp";
        var preserved = await media.PreserveAsync(AvatarImages.LargeKey(prefix), evidenceKey, cancellationToken);
        if (!preserved)
        {
            LogEvidenceNotKept(logger, user.Id);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.AvatarKey = null;
        user.IsEnabled = false;
        await sessions.RevokeAllAsync(user.Id, cancellationToken);
        await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.LegalHold, request.Reason, request.ReportId, ReportTargets.Photo, prefix, preserved ? evidenceKey : null, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var purged = await PhotoEndpoints.RemoveFilesAsync(media, prefix, logger, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse(preserved ? "held" : "held_without_evidence", purged));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> MuteAsync(
        string username,
        MuteRequest request,
        HttpContext context,
        AppDbContext db,
        AccountLinks links,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        var until = time.GetUtcNow().AddDays(request.Days);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.MutedUntil = until;
        var reporters = await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.Mute, request.Reason, request.ReportId, null, null, null, until, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await links.SendModerationNoticeAsync(user, AccountEmailKind.AccountMuted, WallTextClean(request.Reason), until, cancellationToken);
        await NotifyReportersAsync(db, links, reporters, AccountEmailKind.ReportActioned, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("muted", true));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> UnmuteAsync(
        string username,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.MutedUntil = null;
        await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.Unmute, request.Reason, null, null, null, null, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("unmuted", true));
    }

    // Disabling also takes the photo down, so a disabled account leaves no public image behind.
    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> DisableAsync(
        string username,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        AccountLinks links,
        IMediaStore media,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        var prefix = user.AvatarKey;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.IsEnabled = false;
        user.AvatarKey = null;
        await sessions.RevokeAllAsync(user.Id, cancellationToken);
        var reporters = await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.Disable, request.Reason, request.ReportId, null, null, null, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var purged = prefix is null || await PhotoEndpoints.RemoveFilesAsync(media, prefix, loggers.CreateLogger(nameof(ModerationEndpoints)), cancellationToken);
        await links.SendModerationNoticeAsync(user, AccountEmailKind.AccountDisabled, WallTextClean(request.Reason), null, cancellationToken);
        await NotifyReportersAsync(db, links, reporters, AccountEmailKind.ReportActioned, cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("disabled", purged));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> EnableAsync(
        string username,
        ModerationReasonRequest request,
        HttpContext context,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        user.IsEnabled = true;
        await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.Enable, request.Reason, null, null, null, null, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("enabled", true));
    }

    private static async Task<Results<Ok<ModerationResultResponse>, NotFound, ProblemHttpResult>> ChangeRoleAsync(
        string username,
        ChangeRoleRequest request,
        HttpContext context,
        AppDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var staff = Staff(context);
        if (!staff.IsAdmin)
        {
            return NotPermitted();
        }

        var user = await FindAsync(db.Users.AsTracking(), username, cancellationToken);
        if (user is null)
        {
            return TypedResults.NotFound();
        }

        if (!staff.CanActOn(user.Id, user.Role))
        {
            return NotPermitted();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var evidence = $"{user.Role} → {request.Role}";
        user.Role = request.Role;
        await RecordAsync(db, time, staff, user.Id, ModerationActionKinds.ChangeRole, request.Reason, null, null, null, evidence, null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return TypedResults.Ok(new ModerationResultResponse("changed", true));
    }

    /** Saves pending changes with their audit entry and closes the related open reports: the one
     *  named by the moderator (if it concerns this account) and any others about the same content.
     *  Returns who reported them. Runs inside the caller's transaction.
    **/
    private static async Task<List<Guid>> RecordAsync(
        AppDbContext db,
        TimeProvider time,
        StaffMember staff,
        Guid targetUserId,
        string kind,
        string reason,
        Guid? reportId,
        string? targetType,
        string? targetKey,
        string? evidence,
        DateTimeOffset? expiresAt,
        CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        var note = WallTextClean(reason);
        db.ModerationActions.Add(new ModerationAction
        {
            ModeratorId = staff.Id,
            TargetUserId = targetUserId,
            Action = kind,
            ReportId = reportId,
            Reason = note,
            Evidence = evidence,
            ExpiresAt = expiresAt,
            CreatedAt = now,
        });
        await db.SaveChangesAsync(cancellationToken);

        var related = db.ModerationReports.Where(r => r.Status == ReportStatuses.Open && r.ReportedUserId == targetUserId
            && (r.Id == reportId || (targetType != null && r.TargetType == targetType && r.TargetKey == targetKey)));
        var reporters = await related.Select(r => r.ReporterId).Distinct().ToListAsync(cancellationToken);
        await related.ExecuteUpdateAsync(set => set
            .SetProperty(r => r.Status, ReportStatuses.Resolved)
            .SetProperty(r => r.ResolvedById, staff.Id)
            .SetProperty(r => r.ResolvedAt, now)
            .SetProperty(r => r.ResolutionNote, note), cancellationToken);
        return reporters;
    }

    private static async Task NotifyReportersAsync(AppDbContext db, AccountLinks links, List<Guid> reporterIds, AccountEmailKind kind, CancellationToken cancellationToken)
    {
        var reporters = await db.Users.Where(u => reporterIds.Contains(u.Id) && u.IsEnabled).ToListAsync(cancellationToken);
        foreach (var reporter in reporters)
        {
            await links.SendModerationNoticeAsync(reporter, kind, null, null, cancellationToken);
        }
    }

    // Unlike the public lookup, staff can also find disabled accounts.
    private static Task<User?> FindAsync(IQueryable<User> users, string username, CancellationToken cancellationToken)
    {
        if (!Regex.IsMatch(username, AccountRules.UsernamePattern))
        {
            return Task.FromResult<User?>(null);
        }

        var normalized = AccountText.NormalizeUsername(username);
        return users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalized, cancellationToken);
    }

    private static string WallTextClean(string reason) => ModerationText.Clean(reason)!;

    [LoggerMessage(Level = LogLevel.Critical, Message = "Legal hold for user {UserId} kept no evidence copy")]
    private static partial void LogEvidenceNotKept(ILogger logger, Guid userId);
}
