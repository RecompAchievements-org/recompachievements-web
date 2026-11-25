using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Accounts;

public sealed class PlayerEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static Task<HttpResponseMessage> Get(HttpClient client, string username) =>
        client.GetAsync(new Uri($"/api/v1/users/{username}", UriKind.Relative), Ct);

    [Fact]
    public async Task Player_is_found_ignoring_case_and_exposes_only_public_fields()
    {
        using var client = factory.CreateWebsiteClient();
        var username = NewUsername();
        await CreateConfirmedAccount(factory, client, NewEmail(), username);

        using var response = await Get(client, username.ToUpperInvariant());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(["avatar", "createdAt", "lastActiveOn", "role", "username"], json.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
        // A player's role is never shown.
        Assert.Equal(JsonValueKind.Null, json.GetProperty("role").ValueKind);
        Assert.Equal(username, json.GetProperty("username").GetString());
        // A date, with no time of day.
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", json.GetProperty("lastActiveOn").GetString()!);
    }

    [Theory]
    [InlineData("moderator")]
    [InlineData("admin")]
    public async Task Staff_accounts_show_their_role(string role)
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var username = NewUsername();
        await CreateConfirmedAccount(factory, client, email, username);
        await WithDb(factory, db => db.Users.Where(u => u.Email == email)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.Role, role), Ct));

        using var response = await Get(client, username);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

        Assert.Equal(role, json.GetProperty("role").GetString());
    }

    [Theory]
    [InlineData("nobody-has-this-name")]
    [InlineData("a")]
    public async Task Unknown_or_invalid_username_is_not_found(string username)
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Get(client, username);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("settings")]
    [InlineData("Messages")]
    public async Task Names_of_account_pages_are_reserved(string username)
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Register(client, NewEmail(), username);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("username_taken", await ProblemCode(response));
    }

    [Fact]
    public async Task Unconfirmed_registration_is_not_public()
    {
        using var client = factory.CreateWebsiteClient();
        var username = NewUsername();
        using var registered = await Register(client, NewEmail(), username);

        using var response = await Get(client, username);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Disabled_account_is_not_public()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var username = NewUsername();
        await CreateConfirmedAccount(factory, client, email, username);
        await WithDb(factory, db => db.Users.Where(u => u.Email == email)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));

        using var response = await Get(client, username);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
