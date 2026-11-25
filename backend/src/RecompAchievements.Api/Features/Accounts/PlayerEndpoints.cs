using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Infrastructure.Media;

namespace RecompAchievements.Api.Features.Accounts;

/** Public information about a player, available to anyone, including a staff role (moderator or
 *  admin) so official accounts are recognizable. Never add an email, platform ID, alpha status, or
 *  exact activity time here. Disabled accounts and unconfirmed registrations don't exist publicly.
**/
internal static class PlayerEndpoints
{
    public static RouteGroupBuilder MapPlayerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGroup("/users").WithTags("Players")
            .MapGet("/{username}", GetAsync)
            .WithSummary("A player's public information");

        return api;
    }

    // The publicly visible player with this username (ignoring case), if any.
    public static IQueryable<User> PublicByUsername(this IQueryable<User> users, string username)
    {
        if (!Regex.IsMatch(username, AccountRules.UsernamePattern))
        {
            return users.Where(_ => false);
        }

        var normalized = AccountText.NormalizeUsername(username);
        return users.Where(u => u.NormalizedUsername == normalized && u.IsEnabled && (u.Email == null || u.EmailConfirmed));
    }

    private static async Task<Results<Ok<PublicPlayerResponse>, NotFound>> GetAsync(
        string username,
        AppDbContext db,
        IMediaStore media,
        CancellationToken cancellationToken)
    {
        var player = await db.Users
            .PublicByUsername(username)
            .Select(u => new { u.Username, u.CreatedAt, u.LastActivityAt, u.AvatarKey, u.Role })
            .FirstOrDefaultAsync(cancellationToken);

        return player is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(new PublicPlayerResponse(
                player.Username,
                player.CreatedAt,
                DateOnly.FromDateTime(player.LastActivityAt.UtcDateTime),
                AvatarImages.Urls(media, player.AvatarKey),
                player.Role == UserRoles.Player ? null : player.Role));
    }
}
