using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.Comments;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Comments;

public sealed class WallTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static string Wall(string username) => $"/api/v1/users/{username}/wall";

    private async Task<(string Username, string Session, string Email)> NewPlayer()
    {
        using var client = factory.CreateWebsiteClient();
        var (username, email) = (NewUsername(), NewEmail());
        return (username, await CreateConfirmedAccount(factory, client, email, username), email);
    }

    private static async Task<string> PostComment(HttpClient client, string wall, string session, string body = "Hello there")
    {
        using var response = await Send(client, HttpMethod.Post, Wall(wall), session, new { body });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return json.GetProperty("id").GetString()!;
    }

    private static async Task<JsonElement> Page(HttpClient client, string wall, string? session = null, int? page = null)
    {
        using var response = await Send(client, HttpMethod.Get, Wall(wall) + (page is null ? string.Empty : $"?page={page}"), session);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    [Fact]
    public async Task Anyone_can_read_a_wall_and_can_delete_nothing()
    {
        var (owner, ownerSession, _) = await NewPlayer();
        var (author, authorSession, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        await PostComment(client, owner, authorSession, "  Great run!\r\n\r\n\r\n\r\nGG  ");

        var page = await Page(client, owner);

        var comment = Assert.Single(page.GetProperty("comments").EnumerateArray());
        Assert.Equal(author, comment.GetProperty("authorUsername").GetString());
        Assert.True(comment.GetProperty("authorJoinedAt").TryGetDateTimeOffset(out _));
        Assert.Equal("Great run!\n\nGG", comment.GetProperty("body").GetString());
        Assert.False(comment.GetProperty("canDelete").GetBoolean());
        Assert.True((await Page(client, owner, ownerSession)).GetProperty("comments")[0].GetProperty("canDelete").GetBoolean());
        Assert.True((await Page(client, owner, authorSession)).GetProperty("comments")[0].GetProperty("canDelete").GetBoolean());
    }

    [Fact]
    public async Task Signed_out_visitor_cannot_post()
    {
        var (owner, _, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Post, Wall(owner), null, new { body = "Hi" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Account_without_a_confirmed_email_cannot_post()
    {
        var (owner, _, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        var pending = await (await Post(client, "/api/v1/auth/oauth/github/complete", new
        {
            code = factory.Github.Issue($"{Random.Shared.NextInt64(1, long.MaxValue)}", "octo"),
            codeVerifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
        })).Content.ReadFromJsonAsync<JsonElement>(Ct);
        var session = await SessionToken(await Post(client, "/api/v1/auth/oauth/complete-signup", new
        {
            pendingToken = pending.GetProperty("pendingToken").GetString(),
            username = NewUsername(),
            locale = "en",
        }));

        using var response = await Send(client, HttpMethod.Post, Wall(owner), session, new { body = "Hi" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("email_required", await ProblemCode(response));
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("​​")]
    [InlineData("bad\u0007text")]
    [InlineData("spoof‮txt")]
    public async Task Text_without_visible_content_or_with_forbidden_characters_is_refused(string body)
    {
        var (owner, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Post, Wall(owner), session, new { body });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Oversized_comment_is_refused()
    {
        var (owner, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Post, Wall(owner), session, new { body = new string('a', CommentText.MaxLength + 1) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Html_is_stored_as_plain_text()
    {
        var (owner, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        const string body = "<script>alert(1)</script>";
        await PostComment(client, owner, session, body);

        Assert.Equal(body, (await Page(client, owner)).GetProperty("comments")[0].GetProperty("body").GetString());
    }

    [Fact]
    public async Task Pages_are_numbered_newest_first_with_totals()
    {
        var (owner, session, email) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        await WithDb(factory, async db =>
        {
            var id = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync(Ct);
            var start = DateTimeOffset.UtcNow.AddHours(-1);
            for (var index = 0; index < 30; index++)
            {
                var at = start.AddSeconds(index);
                db.Comments.Add(new Comment { Id = Guid.CreateVersion7(at), WallUserId = id, AuthorId = id, Body = $"c{index}", CreatedAt = at });
            }

            await db.SaveChangesAsync(Ct);
        });

        var first = await Page(client, owner);
        var second = await Page(client, owner, page: 2);
        var pastTheEnd = await Page(client, owner, page: 3);

        Assert.Equal(25, first.GetProperty("comments").GetArrayLength());
        Assert.Equal("c29", first.GetProperty("comments")[0].GetProperty("body").GetString());
        Assert.Equal(1, first.GetProperty("page").GetInt32());
        Assert.Equal(30, first.GetProperty("total").GetInt32());
        Assert.Equal(2, first.GetProperty("totalPages").GetInt32());
        Assert.Equal(5, second.GetProperty("comments").GetArrayLength());
        Assert.Equal("c4", second.GetProperty("comments")[0].GetProperty("body").GetString());
        Assert.Empty(pastTheEnd.GetProperty("comments").EnumerateArray());
        Assert.Equal(2, pastTheEnd.GetProperty("totalPages").GetInt32());
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("10001")]
    public async Task Invalid_page_numbers_are_refused(string page)
    {
        var (owner, _, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Get, $"{Wall(owner)}?page={page}", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Author_and_wall_owner_can_delete_and_a_third_player_gets_not_found()
    {
        var (owner, ownerSession, _) = await NewPlayer();
        var (_, authorSession, _) = await NewPlayer();
        var (_, otherSession, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        var byAuthor = await PostComment(client, owner, authorSession);
        var byOwner = await PostComment(client, owner, authorSession);

        using var third = await Send(client, HttpMethod.Delete, $"{Wall(owner)}/{byAuthor}", otherSession);
        using var author = await Send(client, HttpMethod.Delete, $"{Wall(owner)}/{byAuthor}", authorSession);
        using var wallOwner = await Send(client, HttpMethod.Delete, $"{Wall(owner)}/{byOwner}", ownerSession);

        Assert.Equal(HttpStatusCode.NotFound, third.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, author.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, wallOwner.StatusCode);
        Assert.Empty((await Page(client, owner)).GetProperty("comments").EnumerateArray());
    }

    [Fact]
    public async Task Comments_by_disabled_authors_are_hidden_and_disabled_walls_are_not_found()
    {
        var (owner, ownerSession, ownerEmail) = await NewPlayer();
        var (_, authorSession, authorEmail) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        await PostComment(client, owner, authorSession);

        await WithDb(factory, db => db.Users.Where(u => u.Email == authorEmail).ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));
        var hidden = await Page(client, owner, ownerSession);
        Assert.Empty(hidden.GetProperty("comments").EnumerateArray());
        Assert.Equal(0, hidden.GetProperty("total").GetInt32());

        await WithDb(factory, db => db.Users.Where(u => u.Email == ownerEmail).ExecuteUpdateAsync(set => set.SetProperty(u => u.IsEnabled, false), Ct));
        using var wall = await Send(client, HttpMethod.Get, Wall(owner), null);
        Assert.Equal(HttpStatusCode.NotFound, wall.StatusCode);
    }

    [Fact]
    public async Task Posting_too_often_is_limited_per_author()
    {
        var (owner, session, _) = await NewPlayer();
        using var client = factory.CreateWebsiteClient();
        for (var index = 0; index < 10; index++)
        {
            await PostComment(client, owner, session, $"Comment {index}");
        }

        using var response = await Send(client, HttpMethod.Post, Wall(owner), session, new { body = "One too many" });

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }
}
