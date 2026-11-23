using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Data;
using RecompAchievements.Api.Features.Accounts;

namespace RecompAchievements.Api.Tests.Accounts;

// Shared steps for account tests: register, confirm, sign in, and read the database.
internal static partial class AccountTestKit
{
    public const string Password = "correct horse battery";

    public static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static string NewEmail() => $"player-{Guid.NewGuid():N}@example.com";

    public static string NewUsername() => $"p{Guid.NewGuid():N}"[..20];

    public static Task<HttpResponseMessage> Register(HttpClient client, string email, string username, string password = Password, string locale = "en") =>
        client.PostAsJsonAsync("/api/v1/auth/register", new { email, password, username, locale }, Ct);

    public static Task<HttpResponseMessage> SignIn(HttpClient client, string email, string password = Password) =>
        client.PostAsJsonAsync("/api/v1/auth/sign-in", new { email, password }, Ct);

    public static Task<HttpResponseMessage> Post(HttpClient client, string path, object body) =>
        client.PostAsJsonAsync(path, body, Ct);

    // The token from the newest email sent to address.
    public static string LastToken(ApiFactory factory, string address) =>
        TokenPattern().Match(factory.Emails.To(address)[^1].Text).Groups[1].Value;

    // Registers, confirms through the emailed link, and returns a signed-in client's session token.
    public static async Task<string> CreateConfirmedAccount(ApiFactory factory, HttpClient client, string email, string? username = null)
    {
        using var registered = await Register(client, email, username ?? NewUsername());
        Assert.Equal(HttpStatusCode.Accepted, registered.StatusCode);
        using var confirmed = await Post(client, "/api/v1/auth/confirm-email", new { token = LastToken(factory, email) });
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        return await SessionToken(await SignIn(client, email));
    }

    public static async Task<string> SessionToken(HttpResponseMessage response)
    {
        using (response)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
            return json.GetProperty("token").GetString()!;
        }
    }

    public static async Task<HttpResponseMessage> Send(HttpClient client, HttpMethod method, string path, string? session, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path);
        if (session is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, Ct);
    }

    public static async Task<JsonElement> Me(HttpClient client, string session)
    {
        using var response = await Send(client, HttpMethod.Get, "/api/v1/auth/me", session);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    public static async Task<string?> ProblemCode(HttpResponseMessage response)
    {
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return json.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    public static async Task<User?> FindUser(ApiFactory factory, Func<IQueryable<User>, IQueryable<User>> filter)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await filter(db.Users).SingleOrDefaultAsync(Ct);
    }

    public static async Task WithDb(ApiFactory factory, Func<AppDbContext, Task> action)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    [GeneratedRegex(@"token=([A-Za-z0-9_-]+)")]
    private static partial Regex TokenPattern();
}
