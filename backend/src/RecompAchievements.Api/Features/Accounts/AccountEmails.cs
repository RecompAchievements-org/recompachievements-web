using System.Globalization;
using System.Net;
using RecompAchievements.Api.Infrastructure.Email;

namespace RecompAchievements.Api.Features.Accounts;

internal enum AccountEmailKind
{
    ConfirmEmail,
    SetPassword,
    AlreadyRegistered,
    PasswordChanged,
    PlatformConnected,
}

// The localized account emails (English, Spanish, Brazilian Portuguese).
internal static class AccountEmails
{
    private sealed record Copy(string Subject, string Body, string? Action = null, string? Footer = null);

    private sealed record Common(string Greeting, string Signature);

    private static readonly Dictionary<string, Common> Commons = new()
    {
        ["en"] = new("Hi {0},", "The RecompAchievements team"),
        ["es"] = new("Hola, {0}:", "El equipo de RecompAchievements"),
        ["pt"] = new("Olá, {0}!", "Equipe RecompAchievements"),
    };

    private static readonly Dictionary<(AccountEmailKind, string), Copy> Copies = new()
    {
        [(AccountEmailKind.ConfirmEmail, "en")] = new(
            "Confirm your RecompAchievements email",
            "Please confirm this email address for your RecompAchievements account. Once it’s confirmed, your account can collect achievements.",
            "Confirm My Email",
            "This link expires in 24 hours. If you didn’t ask for this, you can ignore this email."),
        [(AccountEmailKind.ConfirmEmail, "es")] = new(
            "Confirma tu correo de RecompAchievements",
            "Confirma esta dirección de correo para tu cuenta de RecompAchievements. Cuando esté confirmada, tu cuenta podrá conseguir logros.",
            "Confirmar mi correo",
            "Este enlace caduca en 24 horas. Si no lo pediste, ignora este correo."),
        [(AccountEmailKind.ConfirmEmail, "pt")] = new(
            "Confirme seu e-mail do RecompAchievements",
            "Confirme este endereço de e-mail para sua conta do RecompAchievements. Depois de confirmado, sua conta poderá ganhar conquistas.",
            "Confirmar meu e-mail",
            "Este link expira em 24 horas. Se você não pediu isso, ignore este e-mail."),

        [(AccountEmailKind.SetPassword, "en")] = new(
            "Set your RecompAchievements password",
            "Someone asked to set or reset the password of your RecompAchievements account. Use this link to choose a new password:",
            "Choose a Password",
            "This link expires in 1 hour and works once. If you didn’t ask for this, ignore this email; your account is unchanged."),
        [(AccountEmailKind.SetPassword, "es")] = new(
            "Elige tu contraseña de RecompAchievements",
            "Alguien pidió crear o restablecer la contraseña de tu cuenta de RecompAchievements. Usa este enlace para elegir una nueva:",
            "Elegir una contraseña",
            "Este enlace caduca en 1 hora y solo funciona una vez. Si no lo pediste, ignora este correo; tu cuenta no cambia."),
        [(AccountEmailKind.SetPassword, "pt")] = new(
            "Defina sua senha do RecompAchievements",
            "Alguém pediu para definir ou redefinir a senha da sua conta do RecompAchievements. Use este link para escolher uma nova:",
            "Escolher uma senha",
            "Este link expira em 1 hora e funciona uma vez. Se você não pediu isso, ignore este e-mail; sua conta não muda."),

        [(AccountEmailKind.AlreadyRegistered, "en")] = new(
            "You already have a RecompAchievements account",
            "Someone tried to sign up with this email, but it already has an account. If it was you, sign in, or use this link to choose a new password:",
            "Choose a Password",
            "This link expires in 1 hour and works once. If it wasn’t you, ignore this email; your account is unchanged."),
        [(AccountEmailKind.AlreadyRegistered, "es")] = new(
            "Ya tienes una cuenta de RecompAchievements",
            "Alguien intentó registrarse con este correo, pero ya tiene una cuenta. Si fuiste tú, inicia sesión o usa este enlace para elegir una contraseña nueva:",
            "Elegir una contraseña",
            "Este enlace caduca en 1 hora y solo funciona una vez. Si no fuiste tú, ignora este correo; tu cuenta no cambia."),
        [(AccountEmailKind.AlreadyRegistered, "pt")] = new(
            "Você já tem uma conta do RecompAchievements",
            "Alguém tentou se cadastrar com este e-mail, mas ele já tem uma conta. Se foi você, entre ou use este link para escolher uma nova senha:",
            "Escolher uma senha",
            "Este link expira em 1 hora e funciona uma vez. Se não foi você, ignore este e-mail; sua conta não muda."),

        [(AccountEmailKind.PasswordChanged, "en")] = new(
            "Your RecompAchievements password was changed",
            "The password of your RecompAchievements account was just set, and every device was signed out.",
            Footer: "If you didn’t do this, choose a new password with “Forgot password?” on the sign-in page and contact us at contact@recompachievements.org."),
        [(AccountEmailKind.PasswordChanged, "es")] = new(
            "Se cambió tu contraseña de RecompAchievements",
            "Se acaba de establecer la contraseña de tu cuenta de RecompAchievements y se cerró la sesión en todos los dispositivos.",
            Footer: "Si no fuiste tú, elige una contraseña nueva con «¿Olvidaste tu contraseña?» en la página de inicio de sesión y escríbenos a contact@recompachievements.org."),
        [(AccountEmailKind.PasswordChanged, "pt")] = new(
            "Sua senha do RecompAchievements foi alterada",
            "A senha da sua conta do RecompAchievements acabou de ser definida, e todos os dispositivos foram desconectados.",
            Footer: "Se não foi você, escolha uma nova senha em “Esqueceu a senha?” na página de entrada e fale conosco em contact@recompachievements.org."),

        [(AccountEmailKind.PlatformConnected, "en")] = new(
            "{1} was connected to your RecompAchievements account",
            "{1} was just connected to your RecompAchievements account, so it can now be used to sign in.",
            Footer: "If you didn’t do this, disconnect it from your account settings and contact us at contact@recompachievements.org."),
        [(AccountEmailKind.PlatformConnected, "es")] = new(
            "Se conectó {1} a tu cuenta de RecompAchievements",
            "Se acaba de conectar {1} a tu cuenta de RecompAchievements, así que ahora sirve para iniciar sesión.",
            Footer: "Si no fuiste tú, desconéctalo desde los ajustes de tu cuenta y escríbenos a contact@recompachievements.org."),
        [(AccountEmailKind.PlatformConnected, "pt")] = new(
            "{1} foi conectado à sua conta do RecompAchievements",
            "{1} acabou de ser conectado à sua conta do RecompAchievements e agora pode ser usado para entrar.",
            Footer: "Se não foi você, desconecte-o nas configurações da sua conta e fale conosco em contact@recompachievements.org."),
    };

    /** Builds one email. Link is the full action URL (for kinds with a button); Platform fills "{1}"
     *  in the platform notice. Every inserted value is HTML-encoded.
    **/
    public static EmailMessage Build(
        AccountEmailKind kind,
        string toAddress,
        string username,
        string locale,
        Uri? link = null,
        string? platform = null)
    {
        var language = Commons.ContainsKey(locale) ? locale : "en";
        var common = Commons[language];
        var copy = Copies[(kind, language)];

        string Fill(string value) => string.Format(CultureInfo.InvariantCulture, value, username, platform ?? string.Empty);

        var greeting = Fill(common.Greeting);
        var subject = Fill(copy.Subject);
        var body = Fill(copy.Body);
        var url = link?.ToString();

        var text = string.Join("\n\n", new[]
        {
            greeting,
            url is null ? body : $"{body}\n{url}",
            copy.Footer,
            $"— {common.Signature}",
        }.Where(part => part is not null));

        var button = url is null || copy.Action is null
            ? string.Empty
            : $"""<p><a href="{Encode(url)}" style="display:inline-block;padding:12px 20px;background:#8b7bff;color:#0a0c14;border-radius:8px;font-weight:600;text-decoration:none">{Encode(copy.Action)}</a></p>""";
        var footer = copy.Footer is null ? string.Empty : $"<p>{Encode(copy.Footer)}</p>";

        var html = $"""
            <p>{Encode(greeting)}</p>
            <p>{Encode(body)}</p>
            {button}
            {footer}
            <p>— {Encode(common.Signature)}</p>
            """;

        return new EmailMessage(toAddress, username, subject, text, html);
    }

    // A website page link in the user's language, e.g. /es/reset-password?token=….
    public static Uri PageLink(Uri siteBaseUrl, string locale, string path, string token)
    {
        var prefix = locale is "es" or "pt" ? "/" + locale : string.Empty;
        return new Uri(siteBaseUrl, $"{prefix}{path}?token={Uri.EscapeDataString(token)}");
    }

    private static string Encode(string value) => WebUtility.HtmlEncode(value);
}
