using System.Net.Http.Headers;
using System.Text.Json.Serialization;

namespace RecompAchievements.Api.Infrastructure.Email;

public sealed record EmailMessage(string ToAddress, string ToName, string Subject, string Text, string Html);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

internal sealed class EmailOptions
{
    public string FromAddress { get; set; } = "contact@recompachievements.org";
    public string FromName { get; set; } = "RecompAchievements";

    // Confirmation emails per rolling 24 hours, kept under the provider's free daily quota.
    public int DailyConfirmationLimit { get; set; } = 200;

    // Account links (email confirmation, set password) per rolling 24 hours, site-wide.
    public int DailyAccountEmailLimit { get; set; } = 200;
}

internal static class EmailSending
{
    /** Uses Brevo's transactional API when "Brevo:ApiKey" is set. Without a key, Development logs
     *  the email instead (so confirmation links can be copied from the console); any other
     *  environment refuses to start, because sign-ups would silently never get their email.
    **/
    public static IServiceCollection AddEmailSending(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.Configure<EmailOptions>(configuration.GetSection("Email"));
        var apiKey = configuration["Brevo:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            {
                throw new InvalidOperationException("Brevo:ApiKey is required outside Development. Set Brevo__ApiKey.");
            }

            services.AddSingleton<IEmailSender, LoggingEmailSender>();
            return services;
        }

        services.AddHttpClient<IEmailSender, BrevoEmailSender>(client =>
            {
                client.BaseAddress = new Uri("https://api.brevo.com/v3/");
                client.DefaultRequestHeaders.Add("api-key", apiKey);
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            })
            .AddStandardResilienceHandler();

        return services;
    }
}

internal sealed partial class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        LogEmail(message.ToAddress, message.Subject, message.Text);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Email not sent (no Brevo key). To: {To} | Subject: {Subject}\n{Text}")]
    private partial void LogEmail(string to, string subject, string text);
}

internal sealed class BrevoEmailSender(HttpClient http, Microsoft.Extensions.Options.IOptions<EmailOptions> options) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var from = options.Value;
        var payload = new BrevoEmail(
            new BrevoContact(from.FromAddress, from.FromName),
            [new BrevoContact(message.ToAddress, message.ToName)],
            message.Subject,
            message.Html,
            message.Text);

        using var response = await http.PostAsJsonAsync("smtp/email", payload, BrevoJsonContext.Default.BrevoEmail, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}

internal sealed record BrevoContact(string Email, string Name);

internal sealed record BrevoEmail(BrevoContact Sender, BrevoContact[] To, string Subject, string HtmlContent, string TextContent);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(BrevoEmail))]
internal sealed partial class BrevoJsonContext : JsonSerializerContext;
