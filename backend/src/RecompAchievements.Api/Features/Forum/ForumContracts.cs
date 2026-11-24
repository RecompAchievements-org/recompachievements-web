using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Comments;

namespace RecompAchievements.Api.Features.Forum;

internal static partial class ForumText
{
    public const int MaxTitleLength = 140;
    public const int MaxBodyLength = 20_000;
    public const int MaxSlugLength = 80;
    public const int ExcerptLength = 220;

    // Path words the website uses next to post slugs.
    private static readonly HashSet<string> ReservedSlugs = ["new", "edit", "drafts", "page"];

    public static bool IsValidSlug(string slug) => SlugPattern().IsMatch(slug) && !ReservedSlugs.Contains(slug);

    public static IEnumerable<string> Problems(ForumTextInput? text, int maxLength, bool singleLine, string field)
    {
        if (text is null || string.IsNullOrWhiteSpace(text.En))
        {
            yield return $"{field}: English is required.";
            yield break;
        }

        foreach (var (language, value) in new[] { ("en", text.En), ("es", text.Es), ("pt", text.Pt) })
        {
            if (value is null)
            {
                continue;
            }

            if (value.Length > maxLength)
            {
                yield return $"{field} ({language}) is longer than {maxLength} characters.";
            }
            else if (!string.IsNullOrWhiteSpace(value) && (!CommentText.IsAllowed(value) || (singleLine && value.Contains('\n', StringComparison.Ordinal))))
            {
                yield return $"{field} ({language}) contains characters that aren't allowed.";
            }
        }
    }

    // Blank translations are stored as missing, so readers fall back to English.
    public static Games.LocalizedText Clean(ForumTextInput text, bool singleLine)
    {
        string? Tidy(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : singleLine ? value.Trim() : value.ReplaceLineEndings("\n").Trim();

        return new Games.LocalizedText(Tidy(text.En)!, Tidy(text.Es), Tidy(text.Pt));
    }

    // The first paragraph as plain text, for lists and page descriptions.
    public static string Excerpt(string markdown)
    {
        var paragraph = markdown.ReplaceLineEndings("\n").Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(block => block.Trim())
            .FirstOrDefault(block => !block.StartsWith('#') && !block.StartsWith("- ", StringComparison.Ordinal)) ?? string.Empty;
        var plain = Whitespace().Replace(MarkdownMarks().Replace(LinkPattern().Replace(paragraph, "$1"), string.Empty), " ").Trim();
        return plain.Length <= ExcerptLength ? plain : plain[..(ExcerptLength - 1)].TrimEnd() + "…";
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();

    [GeneratedRegex(@"\[([^\]]*)\]\([^)]*\)")]
    private static partial Regex LinkPattern();

    [GeneratedRegex(@"[*`#]")]
    private static partial Regex MarkdownMarks();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

public sealed record ForumTextInput(string En, string? Es, string? Pt);

public sealed record SaveForumPostRequest(
    [property: Required, MaxLength(ForumText.MaxSlugLength)] string Slug,
    [property: Required] ForumTextInput Title,
    [property: Required] ForumTextInput Body,
    [property: Required, AllowedValues(ForumPostStatus.Draft, ForumPostStatus.Published)] string Status,
    bool Pinned) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Slug is not null && !ForumText.IsValidSlug(Slug))
        {
            yield return new ValidationResult("Use lowercase letters, digits, and single hyphens.", [nameof(Slug)]);
        }

        foreach (var problem in ForumText.Problems(Title, ForumText.MaxTitleLength, singleLine: true, nameof(Title)))
        {
            yield return new ValidationResult(problem, [nameof(Title)]);
        }

        foreach (var problem in ForumText.Problems(Body, ForumText.MaxBodyLength, singleLine: false, nameof(Body)))
        {
            yield return new ValidationResult(problem, [nameof(Body)]);
        }
    }
}

public sealed record ForumCategoryResponse(
    string Key,
    string Name,
    string Description,
    bool AdminOnly,
    bool CommentsEnabled,
    int PostCount,
    ForumPostSummaryResponse[] PinnedPosts,
    ForumPostSummaryResponse[] RecentPosts);

public sealed record ForumPostSummaryResponse(
    string Slug,
    string Title,
    string Excerpt,
    string Status,
    bool Pinned,
    string? AuthorUsername,
    DateTimeOffset? PublishedAt,
    DateTimeOffset CreatedAt);

public sealed record ForumPostPageResponse(
    ForumCategoryResponse Category,
    ForumPostSummaryResponse[] Posts,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);

public sealed record ForumPostResponse(
    string CategoryKey,
    string CategoryName,
    bool CommentsEnabled,
    string Slug,
    string Title,
    string Body,
    string Excerpt,
    string[] Languages,
    string Status,
    string? AuthorUsername,
    PlayerAvatarResponse? AuthorAvatar,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PublishedAt,
    DateTimeOffset? EditedAt);

// Every language as written, for the admin editor.
public sealed record ForumPostSourceResponse(
    string Slug,
    ForumTextInput Title,
    ForumTextInput Body,
    string Status,
    bool Pinned,
    DateTimeOffset? PublishedAt);
