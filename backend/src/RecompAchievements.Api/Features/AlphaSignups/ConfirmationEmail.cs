using System.Net;
using RecompAchievements.Api.Infrastructure.Email;

namespace RecompAchievements.Api.Features.AlphaSignups;

// The localized double opt-in email (English, Spanish, Brazilian Portuguese).
internal static class ConfirmationEmail
{
    private sealed record Copy(
        string Subject,
        string Greeting,
        string Intro,
        string Action,
        string Expiry,
        string Ignore,
        string Privacy,
        string Signature);

    private static readonly Dictionary<string, Copy> Copies = new()
    {
        ["en"] = new(
            "Confirm your RecompAchievements alpha sign-up",
            "Hi {0},",
            "Thanks for signing up to test the RecompAchievements alpha. Please confirm your email address:",
            "Confirm My Email",
            "This link expires in 7 days.",
            "If you didn’t sign up, you can ignore this email and nothing will be stored after the link expires.",
            "How we use your data:",
            "The RecompAchievements team"),
        ["es"] = new(
            "Confirma tu registro en la alfa de RecompAchievements",
            "Hola, {0}:",
            "Gracias por apuntarte para probar la alfa de RecompAchievements. Confirma tu dirección de correo:",
            "Confirmar mi correo",
            "Este enlace caduca en 7 días.",
            "Si no te registraste, ignora este correo; no conservaremos nada cuando caduque el enlace.",
            "Cómo usamos tus datos:",
            "El equipo de RecompAchievements"),
        ["pt"] = new(
            "Confirme sua inscrição no alfa do RecompAchievements",
            "Olá, {0}!",
            "Obrigado por se inscrever para testar o alfa do RecompAchievements. Confirme seu endereço de e-mail:",
            "Confirmar meu e-mail",
            "Este link expira em 7 dias.",
            "Se você não se inscreveu, ignore este e-mail; nada será guardado depois que o link expirar.",
            "Como usamos seus dados:",
            "Equipe RecompAchievements"),
    };

    public static EmailMessage Build(AlphaSignup signup, string token, Uri siteBaseUrl)
    {
        var copy = Copies.TryGetValue(signup.Locale, out var localized) ? localized : Copies["en"];
        var prefix = signup.Locale == "en" ? string.Empty : "/" + signup.Locale;
        var confirmUrl = new Uri(siteBaseUrl, $"{prefix}/alpha/confirm?token={token}").ToString();
        var privacyUrl = new Uri(siteBaseUrl, $"{prefix}/privacy").ToString();
        var greeting = string.Format(System.Globalization.CultureInfo.InvariantCulture, copy.Greeting, signup.Nickname);

        var text = $"""
            {greeting}

            {copy.Intro}
            {confirmUrl}

            {copy.Expiry}
            {copy.Ignore}

            {copy.Privacy} {privacyUrl}

            — {copy.Signature}
            """;

        var html = $"""
            <p>{Encode(greeting)}</p>
            <p>{Encode(copy.Intro)}</p>
            <p><a href="{Encode(confirmUrl)}" style="display:inline-block;padding:12px 20px;background:#8b7bff;color:#0a0c14;border-radius:8px;font-weight:600;text-decoration:none">{Encode(copy.Action)}</a></p>
            <p>{Encode(copy.Expiry)}<br>{Encode(copy.Ignore)}</p>
            <p>{Encode(copy.Privacy)} <a href="{Encode(privacyUrl)}">{Encode(privacyUrl)}</a></p>
            <p>— {Encode(copy.Signature)}</p>
            """;

        return new EmailMessage(signup.Email, signup.Nickname, copy.Subject, text, html);
    }

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
