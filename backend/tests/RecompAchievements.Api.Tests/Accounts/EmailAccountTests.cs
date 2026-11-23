using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.AlphaSignups;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Accounts;

public sealed class EmailAccountTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Register_confirm_and_sign_in_returns_a_session_for_the_account()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var username = NewUsername();

        var session = await CreateConfirmedAccount(factory, client, email, username);

        var me = await Me(client, session);
        Assert.Equal(username, me.GetProperty("username").GetString());
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.True(me.GetProperty("emailConfirmed").GetBoolean());
        Assert.True(me.GetProperty("hasPassword").GetBoolean());
        Assert.True(me.GetProperty("canCollectAchievements").GetBoolean());
        Assert.False(me.GetProperty("isAlphaTester").GetBoolean());
        var memberSince = me.GetProperty("createdAt").GetDateTimeOffset();
        Assert.True(me.GetProperty("lastActivityAt").GetDateTimeOffset() >= memberSince);
    }

    [Fact]
    public async Task Confirmation_email_is_localized_and_links_to_the_locale()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();

        using var response = await Register(client, email, NewUsername(), locale: "es");

        var message = Assert.Single(factory.Emails.To(email));
        Assert.StartsWith("Confirma tu correo", message.Subject, StringComparison.Ordinal);
        Assert.Contains("https://recompachievements.test/es/confirm-email?token=", message.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Unconfirmed_account_cannot_sign_in_even_with_the_right_password()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var registered = await Register(client, email, NewUsername());

        using var response = await SignIn(client, email);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_credentials", await ProblemCode(response));
    }

    [Fact]
    public async Task Every_sign_in_failure_returns_the_same_answer()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);

        using var wrongPassword = await SignIn(client, email, "not the password");
        using var unknownEmail = await SignIn(client, NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        var first = await wrongPassword.Content.ReadFromJsonAsync<JsonElement>(Ct);
        var second = await unknownEmail.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(first.GetProperty("title").GetString(), second.GetProperty("title").GetString());
        Assert.Equal("invalid_credentials", first.GetProperty("code").GetString());
        Assert.Equal("invalid_credentials", second.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Empty_password_is_rejected_before_any_check()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await SignIn(client, NewEmail(), string.Empty);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Repeated_wrong_passwords_lock_sign_in_even_for_the_right_password()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);

        for (var attempt = 0; attempt < 10; attempt++)
        {
            using var failed = await SignIn(client, email, "wrong password!");
        }

        using var locked = await SignIn(client, email);

        Assert.Equal(HttpStatusCode.Unauthorized, locked.StatusCode);
        Assert.Equal("invalid_credentials", await ProblemCode(locked));
    }

    [Fact]
    public async Task Register_with_a_confirmed_email_answers_the_same_and_emails_the_owner()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);
        var sentBefore = factory.Emails.To(email).Count;

        using var again = await Register(client, email, NewUsername(), "another password");

        Assert.Equal(HttpStatusCode.Accepted, again.StatusCode);
        var notice = factory.Emails.To(email)[^1];
        Assert.Equal(sentBefore + 1, factory.Emails.To(email).Count);
        Assert.StartsWith("You already have", notice.Subject, StringComparison.Ordinal);
        using var oldPasswordStillWorks = await SignIn(client, email);
        Assert.Equal(HttpStatusCode.OK, oldPasswordStillWorks.StatusCode);
    }

    [Fact]
    public async Task Taken_username_is_refused_whatever_the_email()
    {
        using var client = factory.CreateWebsiteClient();
        var username = NewUsername();
        await CreateConfirmedAccount(factory, client, NewEmail(), username);

        using var response = await Register(client, NewEmail(), username.ToUpperInvariant());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("username_taken", await ProblemCode(response));
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("has space")]
    [InlineData("way-too-long-for-a-username-here")]
    public async Task Invalid_username_is_rejected(string username)
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Register(client, NewEmail(), username);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Reserved_username_is_never_available()
    {
        using var client = factory.CreateWebsiteClient();

        var available = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/usernames/available?username=Admin", Ct);

        Assert.False(available.GetProperty("available").GetBoolean());
    }

    [Fact]
    public async Task Short_password_is_rejected()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Register(client, NewEmail(), NewUsername(), "short");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_resets_it_once_and_signs_out_every_session()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var session = await CreateConfirmedAccount(factory, client, email);

        using var forgot = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });
        var token = LastToken(factory, email);
        using var reset = await Post(client, "/api/v1/auth/reset-password", new { token, password = "a brand new password" });
        using var reused = await Post(client, "/api/v1/auth/reset-password", new { token, password = "yet another password" });

        Assert.Equal(HttpStatusCode.Accepted, forgot.StatusCode);
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, reused.StatusCode);
        using var oldSession = await Send(client, HttpMethod.Get, "/api/v1/auth/me", session);
        Assert.Equal(HttpStatusCode.Unauthorized, oldSession.StatusCode);
        using var oldPassword = await SignIn(client, email);
        Assert.Equal(HttpStatusCode.Unauthorized, oldPassword.StatusCode);
        using var newPassword = await SignIn(client, email, "a brand new password");
        Assert.Equal(HttpStatusCode.OK, newPassword.StatusCode);
        Assert.StartsWith("Your RecompAchievements password was changed", factory.Emails.To(email)[^1].Subject, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Expired_reset_link_is_refused()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);
        using var forgot = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });
        var token = LastToken(factory, email);
        await WithDb(factory, db => db.UserTokens
            .Where(t => t.Purpose == "set_password")
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct));

        using var reset = await Post(client, "/api/v1/auth/reset-password", new { token, password = "a brand new password" });

        Assert.Equal(HttpStatusCode.Gone, reset.StatusCode);
    }

    [Fact]
    public async Task Forgot_password_for_an_unknown_email_answers_the_same_and_sends_nothing()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();

        using var response = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Empty(factory.Emails.To(email));
    }

    [Fact]
    public async Task Sign_out_ends_the_session()
    {
        using var client = factory.CreateWebsiteClient();
        var session = await CreateConfirmedAccount(factory, client, NewEmail());

        using var signOut = await Send(client, HttpMethod.Post, "/api/v1/auth/sign-out", session);
        using var me = await Send(client, HttpMethod.Get, "/api/v1/auth/me", session);

        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Me_without_a_session_is_unauthorized()
    {
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Get, "/api/v1/auth/me", "not-a-real-token");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private Task Disable(string email) => WithDb(factory, db => db.Users
        .Where(u => u.Email == email)
        .ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));

    [Fact]
    public async Task New_account_is_enabled_and_has_not_been_edited()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var registered = await Register(client, email, NewUsername());

        var user = await FindUser(factory, users => users.Where(u => u.Email == email));

        Assert.True(user!.IsEnabled);
        Assert.Null(user.EditedAt);
    }

    [Fact]
    public async Task Editing_an_account_stamps_edited_at_but_a_failed_sign_in_does_not()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        using var registered = await Register(client, email, NewUsername());
        using var wrong = await SignIn(client, email, "not the password");
        Assert.Null((await FindUser(factory, users => users.Where(u => u.Email == email)))!.EditedAt);

        using var confirmed = await Post(client, "/api/v1/auth/confirm-email", new { token = LastToken(factory, email) });

        Assert.NotNull((await FindUser(factory, users => users.Where(u => u.Email == email)))!.EditedAt);
    }

    [Fact]
    public async Task Last_activity_moves_on_sign_in_and_use_survives_sign_out_and_is_not_an_edit()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var session = await CreateConfirmedAccount(factory, client, email);
        var editedAt = (await FindUser(factory, users => users.Where(u => u.Email == email)))!.EditedAt;
        var old = DateTimeOffset.UtcNow.AddDays(-3);
        await WithDb(factory, db => db.Users.Where(u => u.Email == email)
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.LastActivityAt, old), Ct));

        using var wrong = await SignIn(client, email, "not the password");
        Assert.True((await FindUser(factory, users => users.Where(u => u.Email == email)))!.LastActivityAt < DateTimeOffset.UtcNow.AddDays(-2));

        await SessionToken(await SignIn(client, email));
        var afterSignIn = await FindUser(factory, users => users.Where(u => u.Email == email));
        Assert.True(afterSignIn!.LastActivityAt > DateTimeOffset.UtcNow.AddMinutes(-1));
        Assert.Equal(editedAt, afterSignIn.EditedAt);

        await WithDb(factory, async db =>
        {
            await db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(set => set.SetProperty(u => u.LastActivityAt, old), Ct);
            await db.UserSessions.Where(s => s.UserId == afterSignIn.Id).ExecuteUpdateAsync(set => set.SetProperty(s => s.LastSeenAt, old), Ct);
        });
        var me = await Me(client, session);
        Assert.True(me.GetProperty("lastActivityAt").GetDateTimeOffset() > DateTimeOffset.UtcNow.AddMinutes(-1));

        using var signedOut = await Send(client, HttpMethod.Post, "/api/v1/auth/sign-out", session);
        await WithDb(factory, db => db.UserSessions.Where(s => s.UserId == afterSignIn.Id).ExecuteDeleteAsync(Ct));
        Assert.True((await FindUser(factory, users => users.Where(u => u.Email == email)))!.LastActivityAt > DateTimeOffset.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Disabling_an_account_ends_its_session_and_blocks_sign_in_with_the_usual_answer()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var session = await CreateConfirmedAccount(factory, client, email);

        await Disable(email);

        using var me = await Send(client, HttpMethod.Get, "/api/v1/auth/me", session);
        using var signIn = await SignIn(client, email);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
        Assert.Equal("invalid_credentials", await ProblemCode(signIn));
    }

    [Fact]
    public async Task Disabled_account_gets_no_new_links_and_its_old_link_stops_working()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);
        using var forgot = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });
        var token = LastToken(factory, email);
        await Disable(email);
        var sentBefore = factory.Emails.To(email).Count;

        using var again = await Post(client, "/api/v1/auth/forgot-password", new { email, locale = "en" });
        using var registered = await Register(client, email, NewUsername());
        using var reset = await Post(client, "/api/v1/auth/reset-password", new { token, password = "a brand new password" });

        Assert.Equal(HttpStatusCode.Accepted, again.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, registered.StatusCode);
        Assert.Equal(sentBefore, factory.Emails.To(email).Count);
        Assert.Equal(HttpStatusCode.NotFound, reset.StatusCode);
    }

    [Fact]
    public async Task Alpha_tester_is_recognized_by_a_confirmed_matching_email()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await WithDb(factory, async db =>
        {
            db.AlphaSignups.Add(new AlphaSignup
            {
                Email = email,
                Nickname = "Tester",
                Platforms = ["windows"],
                Locale = "en",
                Status = "confirmed",
                ConfirmationTokenHash = Guid.NewGuid().ToByteArray(),
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync(Ct);
        });

        var session = await CreateConfirmedAccount(factory, client, email);

        Assert.True((await Me(client, session)).GetProperty("isAlphaTester").GetBoolean());
    }
}
