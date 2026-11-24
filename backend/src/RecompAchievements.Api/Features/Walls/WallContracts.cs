using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;
using RecompAchievements.Api.Features.Accounts;

namespace RecompAchievements.Api.Features.Walls;

/** Rules for wall comment text. Comments are plain text: never rendered as HTML or Markdown. Text
 *  needs something visible, and can't contain control characters or the invisible direction
 *  overrides used to disguise text. Emoji joiners and other formatting characters stay allowed.
**/
internal static partial class WallText
{
    public const int MaxLength = 1000;

    public static string Clean(string body) => ExtraBlankLines().Replace(body.ReplaceLineEndings("\n").Trim(), "\n\n");

    public static bool IsAllowed(string body) =>
        body.Any(IsVisible) && !body.Any(c => (char.IsControl(c) && c is not ('\n' or '\r' or '\t')) || IsDirectionOverride(c));

    private static bool IsVisible(char c) =>
        !char.IsWhiteSpace(c) && char.GetUnicodeCategory(c) != UnicodeCategory.Format;

    private static bool IsDirectionOverride(char c) => c is (>= '‪' and <= '‮') or (>= '⁦' and <= '⁩');

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex ExtraBlankLines();
}

public sealed record CreateWallCommentRequest(
    [property: Required, MaxLength(WallText.MaxLength)] string Body) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Body is not null && !WallText.IsAllowed(Body))
        {
            yield return new ValidationResult("The comment has no visible text or contains characters that aren't allowed.", [nameof(Body)]);
        }
    }
}

public sealed record WallCommentResponse(Guid Id, string AuthorUsername, DateTimeOffset AuthorJoinedAt, PlayerAvatarResponse? AuthorAvatar, string Body, DateTimeOffset CreatedAt, bool CanDelete);

public sealed record WallPageResponse(WallCommentResponse[] Comments, Guid? NextCursor);
