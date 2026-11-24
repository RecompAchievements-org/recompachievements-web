using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;

namespace RecompAchievements.Api.Features.Accounts;

internal sealed record CurrentSession(Guid SessionId, Guid UserId);

/** Opaque session tokens for signed-in browsers. The website stores the token in an HttpOnly cookie
 *  and forwards it as "Authorization: Bearer <token>". A session ends after 30 days without use, and
 *  never lasts more than 180 days. Activity is written at most once an hour.
**/
internal sealed class Sessions(AppDbContext db, TimeProvider time)
{
    public static readonly TimeSpan IdleLifetime = TimeSpan.FromDays(30);
    public static readonly TimeSpan MaxLifetime = TimeSpan.FromDays(180);
    private static readonly TimeSpan ActivityWriteInterval = TimeSpan.FromHours(1);

    public async Task<SessionResponse> CreateAsync(Guid userId, CancellationToken cancellationToken)
    {
        var (token, hash) = SecureToken.Create();
        var now = time.GetUtcNow();
        await RecordActivityAsync(userId, now, cancellationToken);
        var session = new UserSession
        {
            UserId = userId,
            TokenHash = hash,
            CreatedAt = now,
            LastSeenAt = now,
            ExpiresAt = now + IdleLifetime,
        };

        db.UserSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return new SessionResponse(token, session.ExpiresAt);
    }

    public async Task<CurrentSession?> ResolveAsync(HttpContext context, CancellationToken cancellationToken)
    {
        var header = context.Request.Headers[HeaderNames.Authorization].ToString();
        const string scheme = "Bearer ";
        if (!header.StartsWith(scheme, StringComparison.Ordinal))
        {
            return null;
        }

        var hash = SecureToken.TryHash(header[scheme.Length..].Trim());
        if (hash is null)
        {
            return null;
        }

        var now = time.GetUtcNow();

        // Joined on every request, so disabling an account takes effect immediately.
        var session = await db.UserSessions
            .Where(s => s.TokenHash == hash && s.ExpiresAt > now)
            .Join(db.Users.Where(u => u.IsEnabled), s => s.UserId, u => u.Id, (s, _) => new { s.Id, s.UserId, s.CreatedAt, s.LastSeenAt })
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return null;
        }

        if (now - session.LastSeenAt >= ActivityWriteInterval)
        {
            var expiresAt = Min(now + IdleLifetime, session.CreatedAt + MaxLifetime);
            await db.UserSessions
                .Where(s => s.Id == session.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(s => s.LastSeenAt, now).SetProperty(s => s.ExpiresAt, expiresAt), cancellationToken);
            await RecordActivityAsync(session.UserId, now, cancellationToken);
        }

        return new CurrentSession(session.Id, session.UserId);
    }

    public Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken) =>
        db.UserSessions.Where(s => s.Id == sessionId).ExecuteDeleteAsync(cancellationToken);

    public Task RevokeAllAsync(Guid userId, CancellationToken cancellationToken) =>
        db.UserSessions.Where(s => s.UserId == userId).ExecuteDeleteAsync(cancellationToken);

    // A direct update, so activity never counts as an edit of the account (User.EditedAt).
    private Task<int> RecordActivityAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken) =>
        db.Users
            .Where(u => u.Id == userId && u.LastActivityAt < now)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.LastActivityAt, now), cancellationToken);

    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;
}
