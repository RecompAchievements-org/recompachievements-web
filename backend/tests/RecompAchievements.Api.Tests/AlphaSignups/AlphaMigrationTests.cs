using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.AlphaSignups;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.AlphaSignups;

public sealed class AlphaMigrationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task A_confirmed_signup_becomes_an_account_welcomed_once_in_its_language()
    {
        var email = NewEmail();
        var stem = NewUsername()[..12];
        await AddSignup(email, nickname: $"{stem} !", locale: "es");

        await Run();
        await Run();

        var user = await FindUser(email);
        Assert.NotNull(user);
        Assert.Equal(stem, user.Username);
        Assert.True(user.EmailConfirmed);
        Assert.Null(user.PasswordHash);
        Assert.Equal("es", user.Locale);

        var signup = await FindSignup(email);
        Assert.NotNull(signup.MigratedAt);
        Assert.Equal(user.Id, signup.MigratedUserId);
        Assert.NotNull(signup.InviteSentAt);
        Assert.Equal(1, await CountUsers(email));

        var welcome = Assert.Single(factory.Emails.To(email));
        Assert.Equal("Tu cuenta de RecompAchievements está lista", welcome.Subject);
        Assert.Contains(stem, welcome.Text, StringComparison.Ordinal);
        Assert.Contains("/es/reset-password?token=", welcome.Text, StringComparison.Ordinal);

        using var client = factory.CreateWebsiteClient();
        using var reset = await Post(client, "/api/v1/auth/reset-password", new { token = LastToken(factory, email), password = Password });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.False(string.IsNullOrEmpty(await SessionToken(await SignIn(client, email))));
    }

    [Fact]
    public async Task A_signup_whose_email_already_has_an_account_is_only_marked()
    {
        using var client = factory.CreateWebsiteClient();
        var email = NewEmail();
        await CreateConfirmedAccount(factory, client, email);
        var emailsBefore = factory.Emails.To(email).Count;
        await AddSignup(email, nickname: NewUsername());

        await Run();

        var signup = await FindSignup(email);
        Assert.NotNull(signup.MigratedAt);
        Assert.Null(signup.MigratedUserId);
        Assert.Null(signup.InviteSentAt);
        Assert.Equal(1, await CountUsers(email));
        Assert.Equal(emailsBefore, factory.Emails.To(email).Count);
    }

    [Fact]
    public async Task Taken_and_reserved_nicknames_get_a_number()
    {
        using var client = factory.CreateWebsiteClient();
        var taken = NewUsername();
        await CreateConfirmedAccount(factory, client, NewEmail(), taken);
        var takenEmail = NewEmail();
        var reservedEmail = NewEmail();
        await AddSignup(takenEmail, nickname: taken);
        await AddSignup(reservedEmail, nickname: "Admin");

        await Run();

        Assert.Equal(taken + "2", (await FindUser(takenEmail))!.Username);
        Assert.StartsWith("Admin", (await FindUser(reservedEmail))!.Username, StringComparison.Ordinal);
        Assert.NotEqual("Admin", (await FindUser(reservedEmail))!.Username);
    }

    [Fact]
    public async Task Pending_signups_are_left_alone()
    {
        var email = NewEmail();
        await AddSignup(email, nickname: NewUsername(), status: AlphaSignupStatus.Pending);

        await Run();

        Assert.Null((await FindSignup(email)).MigratedAt);
        Assert.Null(await FindUser(email));
    }

    [Fact]
    public async Task A_dry_run_changes_nothing()
    {
        var email = NewEmail();
        await AddSignup(email, nickname: NewUsername());

        var result = await Run(dryRun: true);

        Assert.True(result.Created >= 1);
        Assert.Null((await FindSignup(email)).MigratedAt);
        Assert.Null(await FindUser(email));
        Assert.Empty(factory.Emails.To(email));
    }

    [Fact]
    public async Task A_welcome_that_was_not_sent_is_sent_on_the_next_run()
    {
        var email = NewEmail();
        var username = NewUsername();
        await WithDb(factory, async db =>
        {
            var now = DateTimeOffset.UtcNow;
            var user = new User
            {
                Username = username,
                NormalizedUsername = AccountText.NormalizeUsername(username),
                Email = email,
                EmailConfirmed = true,
                Locale = "pt",
                CreatedAt = now,
                LastActivityAt = now,
            };
            db.Users.Add(user);
            db.AlphaSignups.Add(NewSignup(email, username, "pt", AlphaSignupStatus.Confirmed, migratedAt: now, migratedUserId: user.Id));
            await db.SaveChangesAsync(Ct);
        });

        await Run();

        var welcome = Assert.Single(factory.Emails.To(email));
        Assert.Equal("Sua conta do RecompAchievements está pronta", welcome.Subject);
        Assert.NotNull((await FindSignup(email)).InviteSentAt);
    }

    private async Task<AlphaMigrationResult> Run(bool dryRun = false)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await AlphaSignupMigration.RunAsync(scope.ServiceProvider, dryRun, Ct);
    }

    private Task AddSignup(string email, string nickname, string locale = "en", string status = AlphaSignupStatus.Confirmed) =>
        WithDb(factory, async db =>
        {
            db.AlphaSignups.Add(NewSignup(email, nickname, locale, status));
            await db.SaveChangesAsync(Ct);
        });

    private static AlphaSignup NewSignup(string email, string nickname, string locale, string status, DateTimeOffset? migratedAt = null, Guid? migratedUserId = null) => new()
    {
        Email = email,
        Nickname = nickname,
        Platforms = ["windows"],
        Locale = locale,
        Status = status,
        ConfirmationTokenHash = Guid.NewGuid().ToByteArray(),
        ConfirmationExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
        CreatedAt = DateTimeOffset.UtcNow,
        ConfirmedAt = status == AlphaSignupStatus.Confirmed ? DateTimeOffset.UtcNow : null,
        MigratedAt = migratedAt,
        MigratedUserId = migratedUserId,
    };

    private async Task<User?> FindUser(string email)
    {
        User? user = null;
        await WithDb(factory, async db => user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, Ct));
        return user;
    }

    private async Task<int> CountUsers(string email)
    {
        var count = 0;
        await WithDb(factory, async db => count = await db.Users.CountAsync(u => u.Email == email, Ct));
        return count;
    }

    private async Task<AlphaSignup> FindSignup(string email)
    {
        AlphaSignup? signup = null;
        await WithDb(factory, async db => signup = await db.AlphaSignups.SingleAsync(s => s.Email == email, Ct));
        return signup!;
    }
}
