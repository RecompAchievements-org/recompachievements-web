using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Accounts;

public sealed class PlatformAccountTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static string NewPlatformId() => Random.Shared.NextInt64(100_000_000, long.MaxValue).ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static async Task<JsonElement> Complete(HttpClient client, string provider, string code)
    {
        using var response = await Post(client, $"/api/v1/auth/oauth/{provider}/complete", new { code, codeVerifier = Verifier });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private static Task<HttpResponseMessage> CompleteSignup(HttpClient client, string pendingToken, string username) =>
        Post(client, "/api/v1/auth/oauth/complete-signup", new { pendingToken, username, locale = "en" });

    // Signs up through a platform (welcome step included) and returns the new session token.
    private static async Task<string> SignUpWithPlatform(HttpClient client, FakeOAuthProvider platform, string id, string? verifiedEmail)
    {
        var pending = await Complete(client, platform.Name, platform.Issue(id, "Hunter", verifiedEmail));
        Assert.Equal("pending", pending.GetProperty("status").GetString());
        return await SessionToken(await CompleteSignup(client, pending.GetProperty("pendingToken").GetString()!, NewUsername()));
    }

    private static Task<HttpResponseMessage> Connect(HttpClient client, string session, string provider, string code) =>
        Send(client, HttpMethod.Post, $"/api/v1/auth/oauth/{provider}/connect", session, new { code, codeVerifier = Verifier });

    [Fact]
    public async Task Providers_lists_the_configured_platforms()
    {
        using var client = factory.CreateWebsiteClient();

        var providers = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/providers", Ct);

        Assert.Equal(["discord", "github"], providers.GetProperty("providers").EnumerateArray().Select(p => p.GetString()));
    }

    [Fact]
    public async Task Start_returns_an_authorize_url_with_state_and_a_pkce_challenge()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Post(client, "/api/v1/auth/oauth/discord/start", new { });

        var start = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var url = start.GetProperty("authorizeUrl").GetString()!;
        Assert.Contains($"state={start.GetProperty("state").GetString()}", url, StringComparison.Ordinal);
        Assert.Contains("code_challenge=", url, StringComparison.Ordinal);
        Assert.Contains(Uri.EscapeDataString("https://recompachievements.test/auth/callback/discord"), url, StringComparison.Ordinal);
        Assert.True(start.GetProperty("codeVerifier").GetString()!.Length >= 43);
    }

    [Fact]
    public async Task Unknown_platform_is_not_found()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Post(client, "/api/v1/auth/oauth/myspace/start", new { });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task New_platform_sign_up_with_a_verified_email_creates_nothing_until_the_welcome_step()
    {
        using var client = factory.CreateWebsiteClient();
        var id = NewPlatformId();
        var email = NewEmail();

        var pending = await Complete(client, "discord", factory.Discord.Issue(id, "Hunter of Yharnam!", email));

        Assert.Equal("pending", pending.GetProperty("status").GetString());
        Assert.Equal(email, pending.GetProperty("email").GetString());
        Assert.Equal("HunterofYharnam", pending.GetProperty("suggestedUsername").GetString());
        Assert.Null(await FindUser(factory, users => users.Where(u => u.DiscordId == id)));

        var session = await SessionToken(await CompleteSignup(client, pending.GetProperty("pendingToken").GetString()!, NewUsername()));
        var me = await Me(client, session);
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.True(me.GetProperty("canCollectAchievements").GetBoolean());
        Assert.True(me.GetProperty("discordConnected").GetBoolean());
        Assert.False(me.GetProperty("hasPassword").GetBoolean());
    }

    [Fact]
    public async Task Platform_without_a_verified_email_creates_an_account_without_email_that_cannot_collect()
    {
        using var client = factory.CreateWebsiteClient();
        var id = NewPlatformId();

        var pending = await Complete(client, "github", factory.Github.Issue(id, "octo", verifiedEmail: null));
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("email").ValueKind);
        var session = await SessionToken(await CompleteSignup(client, pending.GetProperty("pendingToken").GetString()!, NewUsername()));

        var me = await Me(client, session);
        Assert.Equal(JsonValueKind.Null, me.GetProperty("email").ValueKind);
        Assert.False(me.GetProperty("canCollectAchievements").GetBoolean());
        Assert.True(me.GetProperty("githubConnected").GetBoolean());
    }

    [Fact]
    public async Task Email_less_account_adds_and_confirms_an_email_to_collect_achievements()
    {
        using var client = factory.CreateWebsiteClient();
        var session = await SignUpWithPlatform(client, factory.Github, NewPlatformId(), null);
        var email = NewEmail();

        using var added = await Send(client, HttpMethod.Post, "/api/v1/auth/email/add", session, new { email, locale = "en" });
        Assert.Equal(HttpStatusCode.Accepted, added.StatusCode);
        Assert.False((await Me(client, session)).GetProperty("canCollectAchievements").GetBoolean());

        using var confirmed = await Post(client, "/api/v1/auth/confirm-email", new { token = LastToken(factory, email) });

        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);
        var me = await Me(client, session);
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.True(me.GetProperty("canCollectAchievements").GetBoolean());
        Assert.False(me.GetProperty("hasPassword").GetBoolean());
    }

    [Fact]
    public async Task Account_with_email_but_no_password_cannot_sign_in_with_any_password()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await SignUpWithPlatform(client, factory.Discord, NewPlatformId(), email);

        using var guessed = await SignIn(client, email, "anything at all");
        using var empty = await SignIn(client, email, string.Empty);

        Assert.Equal(HttpStatusCode.Unauthorized, guessed.StatusCode);
        Assert.Equal("invalid_credentials", await ProblemCode(guessed));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_assigns_a_first_password_to_a_platform_account()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await SignUpWithPlatform(client, factory.Discord, NewPlatformId(), email);

        using var forgot = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });
        using var reset = await Post(client, "/api/v1/auth/reset-password", new { token = LastToken(factory, email), password = "my first password" });
        using var signIn = await SignIn(client, email, "my first password");

        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
    }

    [Fact]
    public async Task Linked_platform_id_signs_in_to_its_account()
    {
        using var client = factory.CreateWebsiteClient();
        var id = NewPlatformId();
        var first = await SignUpWithPlatform(client, factory.Discord, id, null);

        var again = await Complete(client, "discord", factory.Discord.Issue(id, "Renamed", NewEmail()));

        Assert.Equal("signed-in", again.GetProperty("status").GetString());
        var second = again.GetProperty("session").GetProperty("token").GetString()!;
        Assert.Equal((await Me(client, first)).GetProperty("id").GetString(), (await Me(client, second)).GetProperty("id").GetString());
    }

    [Fact]
    public async Task Platform_sign_in_never_links_by_email_and_skips_an_email_already_in_use()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var existing = await CreateConfirmedAccount(factory, client, email);

        var pending = await Complete(client, "discord", factory.Discord.Issue(NewPlatformId(), "Hunter", email));

        Assert.Equal("pending", pending.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("email").ValueKind);
        var session = await SessionToken(await CompleteSignup(client, pending.GetProperty("pendingToken").GetString()!, NewUsername()));
        Assert.Equal(JsonValueKind.Null, (await Me(client, session)).GetProperty("email").ValueKind);
        Assert.False((await Me(client, existing)).GetProperty("discordConnected").GetBoolean());
    }

    [Fact]
    public async Task Connecting_a_platform_keeps_the_account_email_even_if_the_platform_has_another()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var session = await CreateConfirmedAccount(factory, client, email);

        using var connected = await Connect(client, session, "github", factory.Github.Issue(NewPlatformId(), "octo", NewEmail()));

        Assert.Equal(HttpStatusCode.OK, connected.StatusCode);
        var result = await connected.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(JsonValueKind.Null, result.GetProperty("emailOffer").ValueKind);
        var me = await Me(client, session);
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.True(me.GetProperty("githubConnected").GetBoolean());
        Assert.StartsWith("GitHub was connected", factory.Emails.To(email)[^1].Subject, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Connecting_still_links_when_the_platform_email_belongs_to_another_account()
    {
        using var client = factory.CreateWebsiteClient();
        var otherEmail = NewEmail();
        await CreateConfirmedAccount(factory, client, otherEmail);
        var session = await SignUpWithPlatform(client, factory.Github, NewPlatformId(), null);

        using var connected = await Connect(client, session, "discord", factory.Discord.Issue(NewPlatformId(), "Hunter", otherEmail));

        Assert.Equal(HttpStatusCode.OK, connected.StatusCode);
        var result = await connected.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(JsonValueKind.Null, result.GetProperty("emailOffer").ValueKind);
        Assert.True((await Me(client, session)).GetProperty("discordConnected").GetBoolean());
    }

    [Fact]
    public async Task Connecting_offers_the_verified_platform_email_only_to_an_account_without_one()
    {
        using var client = factory.CreateWebsiteClient();
        var session = await SignUpWithPlatform(client, factory.Github, NewPlatformId(), null);
        var platformEmail = NewEmail();

        using var connected = await Connect(client, session, "discord", factory.Discord.Issue(NewPlatformId(), "Hunter", platformEmail));

        var result = await connected.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(platformEmail, result.GetProperty("emailOffer").GetString());
        // The offer changes nothing until it goes through our own confirmation.
        Assert.Equal(JsonValueKind.Null, (await Me(client, session)).GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task Connecting_a_platform_id_linked_to_another_account_is_refused()
    {
        using var client = factory.CreateWebsiteClient();
        var id = NewPlatformId();
        await SignUpWithPlatform(client, factory.Discord, id, null);
        var session = await CreateConfirmedAccount(factory, client, NewEmail());

        using var connected = await Connect(client, session, "discord", factory.Discord.Issue(id, "Hunter"));

        Assert.Equal(HttpStatusCode.Conflict, connected.StatusCode);
        Assert.Equal("platform_linked_elsewhere", await ProblemCode(connected));
    }

    [Fact]
    public async Task Disconnecting_the_only_way_to_sign_in_is_refused()
    {
        using var client = factory.CreateWebsiteClient();
        var session = await SignUpWithPlatform(client, factory.Discord, NewPlatformId(), NewEmail());

        using var response = await Send(client, HttpMethod.Delete, "/api/v1/auth/connections/discord", session);

        // A confirmed email without a password isn't a way to sign in.
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("last_sign_in_method", await ProblemCode(response));
    }

    [Fact]
    public async Task Disconnecting_is_allowed_when_the_other_platform_remains()
    {
        using var client = factory.CreateWebsiteClient();
        var session = await SignUpWithPlatform(client, factory.Discord, NewPlatformId(), null);
        using var connected = await Connect(client, session, "github", factory.Github.Issue(NewPlatformId(), "octo"));

        using var response = await Send(client, HttpMethod.Delete, "/api/v1/auth/connections/discord", session);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False((await Me(client, session)).GetProperty("discordConnected").GetBoolean());
    }

    [Fact]
    public async Task Adding_an_email_owned_by_another_account_is_refused()
    {
        using var client = factory.CreateWebsiteClient();
        var taken = NewEmail();
        await CreateConfirmedAccount(factory, client, taken);
        var session = await SignUpWithPlatform(client, factory.Github, NewPlatformId(), null);

        using var response = await Send(client, HttpMethod.Post, "/api/v1/auth/email/add", session, new { email = taken, locale = "en" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("email_in_use", await ProblemCode(response));
    }

    [Fact]
    public async Task Disabled_account_cannot_sign_in_with_its_platform()
    {
        using var client = factory.CreateWebsiteClient();
        var id = NewPlatformId();
        await SignUpWithPlatform(client, factory.Discord, id, null);
        await WithDb(factory, db => db.Users
            .Where(u => u.DiscordId == id)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));

        using var response = await Post(client, "/api/v1/auth/oauth/discord/complete", new { code = factory.Discord.Issue(id, "Hunter"), codeVerifier = Verifier });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("account_disabled", await ProblemCode(response));
    }

    [Fact]
    public async Task Email_of_a_disabled_account_stays_reserved_for_new_platform_sign_ups()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);
        await WithDb(factory, db => db.Users
            .Where(u => u.Email == email)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));

        var pending = await Complete(client, "github", factory.Github.Issue(NewPlatformId(), "octo", email));

        Assert.Equal(JsonValueKind.Null, pending.GetProperty("email").ValueKind);
    }

    [Fact]
    public async Task Refused_or_reused_platform_code_fails()
    {
        using var client = factory.CreateWebsiteClient();
        var code = factory.Discord.Issue(NewPlatformId(), "Hunter");
        await Complete(client, "discord", code);

        using var reused = await Post(client, "/api/v1/auth/oauth/discord/complete", new { code, codeVerifier = Verifier });

        Assert.Equal(HttpStatusCode.BadRequest, reused.StatusCode);
        Assert.Equal("platform_refused", await ProblemCode(reused));
    }

    [Fact]
    public async Task Altered_pending_sign_up_token_is_refused()
    {
        using var client = factory.CreateWebsiteClient();
        var pending = await Complete(client, "discord", factory.Discord.Issue(NewPlatformId(), "Hunter"));
        var token = pending.GetProperty("pendingToken").GetString()!;
        var tampered = string.Concat(token.AsSpan(0, token.Length - 2), token.EndsWith("AA", StringComparison.Ordinal) ? "BB" : "AA");

        using var response = await CompleteSignup(client, tampered, NewUsername());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("signup_expired", await ProblemCode(response));
    }
}
