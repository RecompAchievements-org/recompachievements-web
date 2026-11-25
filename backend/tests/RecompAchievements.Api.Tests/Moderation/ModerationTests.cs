using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.Moderation;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Moderation;

public sealed class ModerationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Mod = "/api/v1/moderation";

    private async Task<(string Username, string Session, string Email)> NewPlayer(string role = "player")
    {
        using var client = factory.CreateWebsiteClient();
        var (username, email) = (NewUsername(), NewEmail());
        var session = await CreateConfirmedAccount(factory, client, email, username);
        if (role != "player")
        {
            await WithDb(factory, db => db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(s => s.SetProperty(u => u.Role, role), Ct));
        }

        return (username, session, email);
    }

    private static async Task<string> Comment(HttpClient client, string wall, string session)
    {
        using var response = await Send(client, HttpMethod.Post, $"/api/v1/users/{wall}/wall", session, new { body = "Rude comment" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetString()!;
    }

    private static Task<HttpResponseMessage> Report(HttpClient client, string session, string target, string type = "profile", string? commentId = null) =>
        Send(client, HttpMethod.Post, "/api/v1/reports", session, new { targetType = type, targetUsername = target, commentId, reason = "harassment", details = "Please review" });

    private async Task<int> AuditCount(string action, string username)
    {
        var count = 0;
        await WithDb(factory, async db =>
        {
            var id = await db.Users.Where(u => u.Username == username).Select(u => u.Id).SingleAsync(Ct);
            count = await db.ModerationActions.CountAsync(a => a.TargetUserId == id && a.Action == action, Ct);
        });
        return count;
    }

    [Theory]
    [InlineData("GET", "/reports")]
    [InlineData("GET", "/log")]
    [InlineData("GET", "/users/someone")]
    [InlineData("POST", "/users/someone/mute")]
    [InlineData("POST", "/users/someone/disable")]
    [InlineData("POST", "/users/someone/photo/remove")]
    [InlineData("PUT", "/users/someone/role")]
    public async Task Staff_endpoints_answer_not_found_to_players_and_visitors(string method, string path)
    {
        var (_, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        object? body = method == "GET" ? null : new { reason = "x", days = 1, role = "admin" };

        using var signedOut = await Send(client, new HttpMethod(method), Mod + path, null, body);
        using var player = await Send(client, new HttpMethod(method), Mod + path, session, body);

        Assert.Equal(HttpStatusCode.NotFound, signedOut.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, player.StatusCode);
    }

    [Fact]
    public async Task Reports_are_idempotent_and_need_a_session()
    {
        var (target, _, _) = await NewPlayer();
        var (_, reporter, reporterEmail) = await NewPlayer();
        var (moderator, moderatorSession, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();

        using var signedOut = await Send(client, HttpMethod.Post, "/api/v1/reports", null, new { targetType = "profile", targetUsername = target, reason = "spam" });
        using var first = await Report(client, reporter, target);
        using var second = await Report(client, reporter, target);

        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, second.StatusCode);
        await WithDb(factory, async db =>
        {
            var id = await db.Users.Where(u => u.Username == target).Select(u => u.Id).SingleAsync(Ct);
            Assert.Equal(1, await db.ModerationReports.CountAsync(r => r.ReportedUserId == id, Ct));
        });

        using var list = await Send(client, HttpMethod.Get, $"{Mod}/reports", moderatorSession);
        var json = await list.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Contains(json.GetProperty("reports").EnumerateArray(), r => r.GetProperty("reportedUsername").GetString() == target);
        Assert.NotNull(moderator);
        Assert.NotNull(reporterEmail);
    }

    [Fact]
    public async Task Players_cannot_report_themselves()
    {
        var (player, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Report(client, session, player);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("cannot_report_self", await ProblemCode(response));
    }

    [Fact]
    public async Task Removing_a_comment_closes_its_reports_audits_and_notifies()
    {
        var (wall, _, _) = await NewPlayer();
        var (author, authorSession, authorEmail) = await NewPlayer();
        var (_, reporter, reporterEmail) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();
        var commentId = await Comment(client, wall, authorSession);
        using (await Report(client, reporter, author, "comment", commentId))
        {
        }

        var noticesBefore = factory.Emails.To(authorEmail).Count;
        using var removed = await Send(client, HttpMethod.Post, $"{Mod}/comments/{commentId}/remove", moderator, new { reason = "Harassment" });

        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        Assert.Equal(1, await AuditCount(ModerationActionKinds.RemoveComment, author));
        Assert.Equal(noticesBefore + 1, factory.Emails.To(authorEmail).Count);
        Assert.Contains("Harassment", factory.Emails.To(authorEmail)[^1].Text, StringComparison.Ordinal);
        Assert.Contains("took action", factory.Emails.To(reporterEmail)[^1].Text, StringComparison.Ordinal);
        await WithDb(factory, async db =>
        {
            var id = Guid.Parse(commentId);
            Assert.False(await db.Comments.AnyAsync(c => c.Id == id, Ct));
            var key = id.ToString();
            Assert.Equal(ReportStatuses.Resolved, await db.ModerationReports.Where(r => r.TargetKey == key).Select(r => r.Status).SingleAsync(Ct));
        });
    }

    [Fact]
    public async Task Moderators_cannot_act_on_themselves_or_other_staff()
    {
        var (self, selfSession, _) = await NewPlayer("moderator");
        var (peer, _, _) = await NewPlayer("moderator");
        var (admin, _, _) = await NewPlayer("admin");
        using var client = factory.CreateWebsiteClient();
        var mute = new { reason = "Test", days = 1 };

        foreach (var target in new[] { self, peer, admin })
        {
            using var response = await Send(client, HttpMethod.Post, $"{Mod}/users/{target}/mute", selfSession, mute);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("moderation_forbidden", await ProblemCode(response));
        }
    }

    [Fact]
    public async Task Only_admins_change_roles_and_never_their_own()
    {
        var (player, _, _) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        var (admin, adminSession, _) = await NewPlayer("admin");
        using var client = factory.CreateWebsiteClient();
        var change = new { role = "moderator", reason = "Trusted helper" };

        using var byModerator = await Send(client, HttpMethod.Put, $"{Mod}/users/{player}/role", moderator, change);
        using var ownRole = await Send(client, HttpMethod.Put, $"{Mod}/users/{admin}/role", adminSession, new { role = "player", reason = "Oops" });
        using var byAdmin = await Send(client, HttpMethod.Put, $"{Mod}/users/{player}/role", adminSession, change);

        Assert.Equal(HttpStatusCode.Forbidden, byModerator.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, ownRole.StatusCode);
        Assert.Equal(HttpStatusCode.OK, byAdmin.StatusCode);
        Assert.Equal(UserRoles.Moderator, (await FindUser(factory, users => users.Where(u => u.Username == player)))!.Role);
        Assert.Equal(1, await AuditCount(ModerationActionKinds.ChangeRole, player));
    }

    [Fact]
    public async Task Mute_blocks_comments_until_it_ends_and_keeps_achievements()
    {
        var (wall, _, _) = await NewPlayer();
        var (player, playerSession, email) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();

        using var muted = await Send(client, HttpMethod.Post, $"{Mod}/users/{player}/mute", moderator, new { reason = "Cool down", days = 3 });
        using var blocked = await Send(client, HttpMethod.Post, $"/api/v1/users/{wall}/wall", playerSession, new { body = "Hi" });
        var me = await Me(client, playerSession);

        Assert.Equal(HttpStatusCode.OK, muted.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal("account_muted", await ProblemCode(blocked));
        Assert.True(me.GetProperty("canCollectAchievements").GetBoolean());
        Assert.Contains("Cool down", factory.Emails.To(email)[^1].Text, StringComparison.Ordinal);

        await WithDb(factory, db => db.Users.Where(u => u.Username == player)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.MutedUntil, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct));
        using var afterExpiry = await Send(client, HttpMethod.Post, $"/api/v1/users/{wall}/wall", playerSession, new { body = "Back" });
        Assert.Equal(HttpStatusCode.Created, afterExpiry.StatusCode);
    }

    [Fact]
    public async Task Disable_ends_sessions_hides_the_profile_and_can_be_undone()
    {
        var (player, playerSession, email) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();

        using var disabled = await Send(client, HttpMethod.Post, $"{Mod}/users/{player}/disable", moderator, new { reason = "Serious abuse" });
        using var me = await Send(client, HttpMethod.Get, "/api/v1/auth/me", playerSession);
        using var profile = await client.GetAsync($"/api/v1/users/{player}", Ct);

        Assert.Equal(HttpStatusCode.OK, disabled.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, profile.StatusCode);
        Assert.Contains("Serious abuse", factory.Emails.To(email)[^1].Text, StringComparison.Ordinal);

        using var enabled = await Send(client, HttpMethod.Post, $"{Mod}/users/{player}/enable", moderator, new { reason = "Appeal accepted" });
        using var restored = await client.GetAsync($"/api/v1/users/{player}", Ct);
        Assert.Equal(HttpStatusCode.OK, enabled.StatusCode);
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
    }

    [Fact]
    public async Task Only_staff_roles_are_public_and_private_data_never_reaches_summaries()
    {
        var (staff, _, _) = await NewPlayer("admin");
        var (player, _, email) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();

        var staffProfile = await client.GetFromJsonAsync<JsonElement>($"/api/v1/users/{staff}", Ct);
        var playerJson = await client.GetStringAsync($"/api/v1/users/{player}", Ct);
        using var summary = await Send(client, HttpMethod.Get, $"{Mod}/users/{player}", moderator);
        var staffJson = await summary.Content.ReadAsStringAsync(Ct);

        // Staff are recognizable on their public profile; a player's role is never shown.
        Assert.Equal("admin", staffProfile.GetProperty("role").GetString());
        Assert.DoesNotContain("player", playerJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(email, playerJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(email, staffJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Invalid_reasons_are_refused()
    {
        var (player, _, _) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();

        using var empty = await Send(client, HttpMethod.Post, $"{Mod}/users/{player}/mute", moderator, new { reason = "   ", days = 1 });
        using var tooLong = await Send(client, HttpMethod.Post, $"{Mod}/users/{player}/mute", moderator, new { reason = "Test", days = 9999 });

        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }
}
