namespace RecompAchievements.Api.Features.Accounts;

/** When the platform's alpha phase ends. Unset while the alpha is running, so every account counts
 *  as an alpha tester; once set, only accounts created before it do (including the accounts migrated
 *  from the earlier alpha list, which are created during the alpha).
**/
internal sealed class AlphaPhaseOptions
{
    public DateTimeOffset? EndsAt { get; set; }

    public bool Includes(DateTimeOffset createdAt) => EndsAt is not { } end || createdAt < end;
}
