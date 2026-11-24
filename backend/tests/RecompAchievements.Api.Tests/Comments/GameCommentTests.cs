using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.Comments;
using RecompAchievements.Api.Features.Moderation;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Comments;

public sealed class GameCommentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Game = "bbport-pc";
    private static string Comments(string slug = Game) => $"/api/v1/games/{slug}/comments";

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

    private static async Task<string> PostComment(HttpClient client, string session, string body = "Runs great on my Steam Deck")
    {
        using var response = await Send(client, HttpMethod.Post, Comments(), session, new { body });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetString()!;
    }

    private static async Task<JsonElement[]> Page(HttpClient client, string? session = null)
    {
        using var response = await Send(client, HttpMethod.Get, Comments(), session);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return [.. (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("comments").EnumerateArray()];
    }

    [Fact]
    public async Task Anyone_reads_and_only_the_author_can_delete()
    {
        var (author, authorSession, _) = await NewPlayer();
        var (_, otherSession, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        var id = await PostComment(client, authorSession, "  Works with 60 FPS mod  ");

        var visitor = Assert.Single(await Page(client), c => c.GetProperty("id").GetString() == id);
        Assert.Equal(author, visitor.GetProperty("authorUsername").GetString());
        Assert.Equal("Works with 60 FPS mod", visitor.GetProperty("body").GetString());
        Assert.False(visitor.GetProperty("canDelete").GetBoolean());
        Assert.True((await Page(client, authorSession)).Single(c => c.GetProperty("id").GetString() == id).GetProperty("canDelete").GetBoolean());

        using var byOther = await Send(client, HttpMethod.Delete, $"{Comments()}/{id}", otherSession);
        using var byAuthor = await Send(client, HttpMethod.Delete, $"{Comments()}/{id}", authorSession);

        Assert.Equal(HttpStatusCode.NotFound, byOther.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, byAuthor.StatusCode);
        Assert.DoesNotContain(await Page(client), c => c.GetProperty("id").GetString() == id);
    }

    [Fact]
    public async Task Signed_out_unconfirmed_and_muted_players_cannot_post()
    {
        var (muted, mutedSession, _) = await NewPlayer();
        await WithDb(factory, db => db.Users.Where(u => u.Username == muted)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.MutedUntil, DateTimeOffset.UtcNow.AddDays(1)), Ct));
        using var client = factory.CreateWebsiteClient();
        var pending = await (await Post(client, "/api/v1/auth/oauth/github/complete", new
        {
            code = factory.Github.Issue($"{Random.Shared.NextInt64(1, long.MaxValue)}", "octo"),
            codeVerifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
        })).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var unconfirmed = await SessionToken(await Post(client, "/api/v1/auth/oauth/complete-signup", new
        {
            pendingToken = pending.GetProperty("pendingToken").GetString(),
            username = NewUsername(),
            locale = "en",
        }));

        using var signedOut = await Send(client, HttpMethod.Post, Comments(), null, new { body = "Hi" });
        using var noEmail = await Send(client, HttpMethod.Post, Comments(), unconfirmed, new { body = "Hi" });
        using var mutedPost = await Send(client, HttpMethod.Post, Comments(), mutedSession, new { body = "Hi" });

        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);
        Assert.Equal("email_required", await ProblemCode(noEmail));
        Assert.Equal("account_muted", await ProblemCode(mutedPost));
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("bad\u0007text")]
    public async Task Invalid_text_is_refused(string body)
    {
        var (_, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Post, Comments(), session, new { body });
        using var tooLong = await Send(client, HttpMethod.Post, Comments(), session, new { body = new string('a', CommentText.MaxLength + 1) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }

    [Fact]
    public async Task Unknown_games_are_not_found()
    {
        var (_, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var read = await Send(client, HttpMethod.Get, Comments("no-such-game"), null);
        using var post = await Send(client, HttpMethod.Post, Comments("no-such-game"), session, new { body = "Hi" });

        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, post.StatusCode);
    }

    [Fact]
    public async Task Comments_by_disabled_authors_are_hidden()
    {
        var (_, session, email) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        var id = await PostComment(client, session);

        await WithDb(factory, db => db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsEnabled, false), Ct));

        Assert.DoesNotContain(await Page(client), c => c.GetProperty("id").GetString() == id);
    }

    [Fact]
    public async Task The_posting_limit_is_shared_between_walls_and_games()
    {
        var (wall, _, _) = await NewPlayer();
        var (_, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        for (var index = 0; index < 10; index++)
        {
            using var posted = await Send(client, HttpMethod.Post, $"/api/v1/users/{wall}/wall", session, new { body = $"Wall {index}" });
            Assert.Equal(HttpStatusCode.Created, posted.StatusCode);
        }

        using var response = await Send(client, HttpMethod.Post, Comments(), session, new { body = "One too many" });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task A_reported_game_comment_can_be_removed_by_a_moderator()
    {
        var (author, authorSession, authorEmail) = await NewPlayer();
        var (_, reporter, _) = await NewPlayer();
        var (_, moderator, _) = await NewPlayer("moderator");
        using var client = factory.CreateWebsiteClient();
        var id = await PostComment(client, authorSession, "Rude game comment");

        using var report = await Send(client, HttpMethod.Post, "/api/v1/reports", reporter, new { targetType = "comment", targetUsername = author, commentId = id, reason = "harassment" });
        Assert.Equal(HttpStatusCode.Accepted, report.StatusCode);
        var reportId = Guid.Empty;
        await WithDb(factory, async db => reportId = await db.ModerationReports.Where(r => r.TargetKey == id).Select(r => r.Id).SingleAsync(Ct));

        using var detail = await Send(client, HttpMethod.Get, $"/api/v1/moderation/reports/{reportId}", moderator);
        var location = (await detail.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("commentLocation");
        Assert.Equal("game", location.GetProperty("kind").GetString());
        Assert.Equal(Game, location.GetProperty("key").GetString());

        using var removed = await Send(client, HttpMethod.Post, $"/api/v1/moderation/comments/{id}/remove", moderator, new { reason = "Harassment", reportId });

        Assert.Equal(HttpStatusCode.OK, removed.StatusCode);
        Assert.DoesNotContain(await Page(client), c => c.GetProperty("id").GetString() == id);
        Assert.Contains("Harassment", factory.Emails.To(authorEmail)[^1].Text, StringComparison.Ordinal);
        await WithDb(factory, async db =>
        {
            Assert.Equal(ReportStatuses.Resolved, await db.ModerationReports.Where(r => r.Id == reportId).Select(r => r.Status).SingleAsync(Ct));
            Assert.True(await db.ModerationActions.AnyAsync(a => a.ReportId == reportId && a.Action == ModerationActionKinds.RemoveComment, Ct));
        });
    }
}
