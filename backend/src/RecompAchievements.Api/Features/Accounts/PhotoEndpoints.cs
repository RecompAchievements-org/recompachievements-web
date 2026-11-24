using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Accounts;

/** The signed-in player's own profile photo. Uploading needs a confirmed email, an established
 *  account, no active mute, and the player's confirmation that they may use the image.
**/
internal static partial class PhotoEndpoints
{
    private const int DefaultMinimumAccountAgeDays = 7;

    public static RouteGroupBuilder MapPhotoEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth/photo").WithTags("Accounts");
        group.MapPut("/", UploadAsync).RequireRateLimiting(RateLimiting.PhotoPolicy).WithSummary("Upload or replace the signed-in player's photo");
        group.MapDelete("/", DeleteAsync).RequireRateLimiting(RateLimiting.PhotoPolicy).WithSummary("Delete the signed-in player's photo");
        return api;
    }

    private static async Task<Results<Ok<PlayerAvatarResponse>, ProblemHttpResult>> UploadAsync(
        bool? rightsConfirmed,
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        IConfiguration configuration,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == session.UserId, cancellationToken);
        var now = time.GetUtcNow();
        var minimumAge = TimeSpan.FromDays(configuration.GetValue("Photos:MinimumAccountAgeDays", DefaultMinimumAccountAgeDays));
        if (!user.CanCollectAchievements)
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "email_required", "Add and confirm an email to upload a photo");
        }

        if (user.IsMutedAt(now))
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "account_muted", "This account is muted");
        }

        if (now - user.CreatedAt < minimumAge)
        {
            return AccountProblems.Create(StatusCodes.Status403Forbidden, "photo_not_allowed_yet", "This account can't upload a photo yet");
        }

        if (rightsConfirmed != true)
        {
            return AccountProblems.Create(StatusCodes.Status400BadRequest, "photo_rights_required", "Confirm that you may use this image");
        }

        if (!media.IsAvailable)
        {
            return AccountProblems.Create(StatusCodes.Status503ServiceUnavailable, "photos_unavailable", "Photo uploads are unavailable");
        }

        var upload = await ReadBodyAsync(context.Request.Body, cancellationToken);
        if (upload is null || AvatarImages.Process(upload) is not { } avatar)
        {
            return AccountProblems.Create(StatusCodes.Status400BadRequest, "photo_invalid", "Use a static JPEG, PNG, or WebP image");
        }

        var prefix = AvatarImages.KeyPrefix(user.Id, avatar.Hash);
        var keys = AvatarImages.Keys(prefix);
        await media.PutAsync(keys[0], avatar.Small, "image/webp", cancellationToken);
        await media.PutAsync(keys[1], avatar.Large, "image/webp", cancellationToken);

        var previous = user.AvatarKey;
        user.AvatarKey = prefix;
        user.AvatarTermsAcceptedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        if (previous is not null && previous != prefix)
        {
            await RemoveFilesAsync(media, previous, loggers.CreateLogger(nameof(PhotoEndpoints)), cancellationToken);
        }

        return TypedResults.Ok(AvatarImages.Urls(media, prefix)!);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAsync(
        HttpContext context,
        AppDbContext db,
        Sessions sessions,
        IMediaStore media,
        ILoggerFactory loggers,
        CancellationToken cancellationToken)
    {
        if (await sessions.ResolveAsync(context, cancellationToken) is not { } session)
        {
            return AccountProblems.NotSignedIn();
        }

        var user = await db.Users.AsTracking().SingleAsync(u => u.Id == session.UserId, cancellationToken);
        if (user.AvatarKey is { } prefix)
        {
            user.AvatarKey = null;
            await db.SaveChangesAsync(cancellationToken);
            await RemoveFilesAsync(media, prefix, loggers.CreateLogger(nameof(PhotoEndpoints)), cancellationToken);
        }

        return TypedResults.NoContent();
    }

    // The account no longer points at the files, so a storage failure is logged rather than shown.
    public static async Task<bool> RemoveFilesAsync(IMediaStore media, string prefix, ILogger logger, CancellationToken cancellationToken)
    {
        var keys = AvatarImages.Keys(prefix);
        try
        {
            await media.DeleteAsync(keys, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogDeleteFailed(logger, exception, prefix);
        }

        return await media.PurgeAsync(keys, cancellationToken);
    }

    private static async Task<byte[]?> ReadBodyAsync(Stream body, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[81_920];
        int read;
        while ((read = await body.ReadAsync(chunk, cancellationToken)) > 0)
        {
            if (buffer.Length + read > AvatarImages.MaxUploadBytes)
            {
                return null;
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.Length == 0 ? null : buffer.ToArray();
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Photo files {Prefix} could not be deleted")]
    private static partial void LogDeleteFailed(ILogger logger, Exception exception, string prefix);
}
