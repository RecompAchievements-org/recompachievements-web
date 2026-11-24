using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Forum;

public sealed class ForumTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Admin = "/api/v1/forum-admin/news/posts";
    private const string Public = "/api/v1/forum/news/posts";

    private async Task<string> NewSession(string role = "player")
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        var session = await CreateConfirmedAccount(factory, client, email);
        if (role != "player")
        {
            await WithDb(factory, db => db.Users.Where(u => u.Email == email).ExecuteUpdateAsync(s => s.SetProperty(u => u.Role, role), Ct));
        }

        return session;
    }

    private static string NewSlug() => $"post-{Guid.NewGuid():N}"[..20];

    private static object Post(string slug, string status = "draft", string title = "Release notes", string? esTitle = null, bool pinned = false) => new
    {
        slug,
        title = new { en = title, es = esTitle, pt = (string?)null },
        body = new { en = "Intro paragraph with **bold** text.\n\n## Details\n\n- One\n- Two", es = (string?)null, pt = (string?)null },
        status,
        pinned,
    };

    [Fact]
    public async Task The_news_category_and_the_alpha_announcement_are_seeded()
    {
        using var client = factory.CreateWebsiteClient();

        var categories = await client.GetFromJsonAsync<JsonElement>("/api/v1/forum/categories?lang=es", Ct);
        var post = await client.GetFromJsonAsync<JsonElement>($"{Public}/alpha-v1-0-is-live?lang=pt", Ct);

        var news = Assert.Single(categories.EnumerateArray(), c => c.GetProperty("key").GetString() == "news");
        Assert.Equal("Últimas noticias", news.GetProperty("name").GetString());
        Assert.True(news.GetProperty("adminOnly").GetBoolean());
        Assert.False(news.GetProperty("commentsEnabled").GetBoolean());
        Assert.Contains(news.GetProperty("pinnedPosts").EnumerateArray(), p => p.GetProperty("slug").GetString() == "alpha-v1-0-is-live");
        Assert.Equal("RecompAchievements Alpha v1.0 já está no ar", post.GetProperty("title").GetString());
        Assert.Equal(["en", "es", "pt"], post.GetProperty("languages").EnumerateArray().Select(l => l.GetString()));
        Assert.Equal(JsonValueKind.Null, post.GetProperty("authorUsername").ValueKind);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("player")]
    [InlineData("moderator")]
    public async Task Admin_endpoints_answer_not_found_to_everyone_else(string? role)
    {
        var session = role is null ? null : await NewSession(role);
        using var client = factory.CreateWebsiteClient();

        using var list = await Send(client, HttpMethod.Get, Admin, session);
        using var create = await Send(client, HttpMethod.Post, Admin, session, Post(NewSlug()));
        using var delete = await Send(client, HttpMethod.Delete, $"{Admin}/alpha-v1-0-is-live", session);

        Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, create.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    [Fact]
    public async Task Drafts_stay_private_until_published_and_slugs_lock_after_publishing()
    {
        var admin = await NewSession("admin");
        using var client = factory.CreateWebsiteClient();
        var slug = NewSlug();

        using var created = await Send(client, HttpMethod.Post, Admin, admin, Post(slug, title: "Draft", esTitle: "Borrador"));
        using var hidden = await client.GetAsync($"{Public}/{slug}", Ct);
        var adminList = await (await Send(client, HttpMethod.Get, Admin, admin)).Content.ReadFromJsonAsync<JsonElement>(Ct);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
        Assert.Contains(adminList.GetProperty("posts").EnumerateArray(), p => p.GetProperty("slug").GetString() == slug && p.GetProperty("status").GetString() == "draft");

        using var published = await Send(client, HttpMethod.Put, $"{Admin}/{slug}", admin, Post(slug, "published", "Published", "Publicado"));
        var english = await client.GetFromJsonAsync<JsonElement>($"{Public}/{slug}", Ct);
        var spanish = await client.GetFromJsonAsync<JsonElement>($"{Public}/{slug}?lang=es", Ct);
        var portuguese = await client.GetFromJsonAsync<JsonElement>($"{Public}/{slug}?lang=pt", Ct);

        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        Assert.Equal("Published", english.GetProperty("title").GetString());
        Assert.Equal("Publicado", spanish.GetProperty("title").GetString());
        Assert.Equal("Published", portuguese.GetProperty("title").GetString());
        Assert.Equal("Intro paragraph with bold text.", english.GetProperty("excerpt").GetString());
        Assert.Equal(JsonValueKind.Null, english.GetProperty("editedAt").ValueKind);

        using var renamed = await Send(client, HttpMethod.Put, $"{Admin}/{slug}", admin, Post(NewSlug(), "published"));
        Assert.Equal("slug_locked", await ProblemCode(renamed));

        using var edited = await Send(client, HttpMethod.Put, $"{Admin}/{slug}", admin, Post(slug, "published", "Edited"));
        var afterEdit = await client.GetFromJsonAsync<JsonElement>($"{Public}/{slug}", Ct);
        Assert.NotEqual(JsonValueKind.Null, afterEdit.GetProperty("editedAt").ValueKind);

        using var unpublished = await Send(client, HttpMethod.Put, $"{Admin}/{slug}", admin, Post(slug, "draft", "Edited"));
        using var gone = await client.GetAsync($"{Public}/{slug}", Ct);
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);

        using var deleted = await Send(client, HttpMethod.Delete, $"{Admin}/{slug}", admin);
        using var source = await Send(client, HttpMethod.Get, $"{Admin}/{slug}", admin);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, source.StatusCode);
    }

    [Theory]
    [InlineData("Bad Slug")]
    [InlineData("new")]
    [InlineData("double--hyphen")]
    public async Task Invalid_or_reserved_slugs_are_refused(string slug)
    {
        var admin = await NewSession("admin");
        using var client = factory.CreateWebsiteClient();

        using var response = await Send(client, HttpMethod.Post, Admin, admin, Post(slug));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Duplicate_slugs_and_invalid_text_are_refused()
    {
        var admin = await NewSession("admin");
        using var client = factory.CreateWebsiteClient();
        var slug = NewSlug();
        using (await Send(client, HttpMethod.Post, Admin, admin, Post(slug)))
        {
        }

        using var duplicate = await Send(client, HttpMethod.Post, Admin, admin, Post(slug));
        using var newlineTitle = await Send(client, HttpMethod.Post, Admin, admin, Post(NewSlug(), title: "Two\nlines"));
        using var controlCharacter = await Send(client, HttpMethod.Post, Admin, admin, Post(NewSlug(), title: "Bell\u0007"));
        using var noEnglish = await Send(client, HttpMethod.Post, Admin, admin, Post(NewSlug(), title: "   "));

        Assert.Equal("slug_taken", await ProblemCode(duplicate));
        Assert.Equal(HttpStatusCode.BadRequest, newlineTitle.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, controlCharacter.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, noEnglish.StatusCode);
    }

    [Fact]
    public async Task Public_lists_are_paged_and_unknown_categories_are_not_found()
    {
        using var client = factory.CreateWebsiteClient();

        var page = await client.GetFromJsonAsync<JsonElement>(Public, Ct);
        using var badPage = await client.GetAsync($"{Public}?page=0", Ct);
        using var unknown = await client.GetAsync("/api/v1/forum/general/posts", Ct);

        Assert.Equal(25, page.GetProperty("pageSize").GetInt32());
        Assert.All(page.GetProperty("posts").EnumerateArray(), p => Assert.Equal("published", p.GetProperty("status").GetString()));
        Assert.Equal(HttpStatusCode.BadRequest, badPage.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Categories_list_pinned_posts_and_the_five_most_recent()
    {
        var admin = await NewSession("admin");
        using var client = factory.CreateWebsiteClient();
        var pinnedSlug = NewSlug();
        using (await Send(client, HttpMethod.Post, Admin, admin, Post(pinnedSlug, "published", "Pinned news", pinned: true)))
        {
        }

        var recentSlugs = new List<string>();
        for (var index = 0; index < 6; index++)
        {
            var slug = NewSlug();
            recentSlugs.Add(slug);
            using var created = await Send(client, HttpMethod.Post, Admin, admin, Post(slug, "published", $"Recent {index}"));
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        var news = (await client.GetFromJsonAsync<JsonElement>("/api/v1/forum/categories", Ct)).EnumerateArray().Single(c => c.GetProperty("key").GetString() == "news");
        var pinned = news.GetProperty("pinnedPosts").EnumerateArray().Select(p => p.GetProperty("slug").GetString()).ToList();
        var recent = news.GetProperty("recentPosts").EnumerateArray().Select(p => p.GetProperty("slug").GetString()).ToList();

        Assert.Equal(pinnedSlug, pinned[0]);
        Assert.Equal(5, recent.Count);
        Assert.Equal(recentSlugs[5], recent[0]);
        Assert.DoesNotContain(recentSlugs[0], recent);

        using var unpinned = await Send(client, HttpMethod.Put, $"{Admin}/{pinnedSlug}", admin, Post(pinnedSlug, "published", "Pinned news"));
        var after = (await client.GetFromJsonAsync<JsonElement>("/api/v1/forum/categories", Ct)).EnumerateArray().Single(c => c.GetProperty("key").GetString() == "news");
        Assert.DoesNotContain(after.GetProperty("pinnedPosts").EnumerateArray(), p => p.GetProperty("slug").GetString() == pinnedSlug);
    }
}
