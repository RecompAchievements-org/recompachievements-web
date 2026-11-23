using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace RecompAchievements.Api.Features.Accounts;

/** Sets User.EditedAt whenever a saved change touches the account's data, so no endpoint can forget
 *  it. Sign-in bookkeeping (failed attempts and temporary locks) isn't an edit.
**/
internal sealed class UserEditStamp(TimeProvider time) : SaveChangesInterceptor
{
    private static readonly HashSet<string> Bookkeeping = [nameof(User.FailedSignInCount), nameof(User.LockedUntil)];

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(eventData);
        if (eventData.Context is { } context)
        {
            var now = time.GetUtcNow();
            foreach (var entry in context.ChangeTracker.Entries<User>().Where(e => e.State == EntityState.Modified))
            {
                if (entry.Properties.Any(p => p.IsModified && !Bookkeeping.Contains(p.Metadata.Name)))
                {
                    entry.Entity.EditedAt = now;
                }
            }
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}
