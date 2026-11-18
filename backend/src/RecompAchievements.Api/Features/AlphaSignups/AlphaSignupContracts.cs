using System.ComponentModel.DataAnnotations;

namespace RecompAchievements.Api.Features.AlphaSignups;

/** Sign-up request sent by the website. Field rules are checked by .NET's built-in endpoint
 *  validation; Validate adds the rules attributes can't express (platform values, consent).
**/
public sealed record CreateAlphaSignupRequest(
    [property: Required, EmailAddress, MaxLength(254)] string Email,
    [property: Required, StringLength(32, MinimumLength = 2)] string Nickname,
    [property: Required] string[] Platforms,
    [property: MaxLength(200)] string? Recomps,
    [property: Required, AllowedValues("en", "es", "pt")] string Locale,
    bool Consent) : IValidatableObject
{
    public static readonly string[] KnownPlatforms = ["windows", "linux", "macos", "steam_deck"];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Platforms is null || Platforms.Length == 0 || Platforms.Any(platform => !KnownPlatforms.Contains(platform)))
        {
            yield return new ValidationResult("Choose at least one known platform.", [nameof(Platforms)]);
        }

        if (!Consent)
        {
            yield return new ValidationResult("Consent to the privacy notice is required.", [nameof(Consent)]);
        }
    }
}

public sealed record ConfirmAlphaSignupRequest([property: Required, MaxLength(64)] string Token);

// Identical for new, pending, and confirmed emails, so responses never reveal who signed up.
public sealed record AlphaSignupAcceptedResponse(string Status);

public sealed record AlphaSignupConfirmedResponse(string Status);
