using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RecompAchievements.Api.Data;
using static RecompAchievements.Api.Tests.Accounts.AccountTestKit;

namespace RecompAchievements.Api.Tests.Comments;

/** Upgrades a database that already holds a wall comment and a report on it, as a developer's or a
 *  preview database would, and checks both survive the move to the shared comments table.
**/
public sealed class CommentMigrationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string BeforeShared = "20261123225351_AddModerationAndPhotos";

    [Fact]
    public async Task Wall_comments_and_their_reports_survive_the_upgrade()
    {
        var baseConnection = factory.Services.GetRequiredService<IConfiguration>().GetConnectionString("Database")!;
        var database = $"upgrade_{Guid.NewGuid():N}";
        await using (var admin = new NpgsqlConnection(baseConnection))
        {
            await admin.OpenAsync(Ct);
            await using var create = new NpgsqlCommand($"CREATE DATABASE {database}", admin);
            await create.ExecuteNonQueryAsync(Ct);
        }

        var connection = new NpgsqlConnectionStringBuilder(baseConnection) { Database = database }.ConnectionString;
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).UseSnakeCaseNamingConvention().Options;
        await using var db = new AppDbContext(options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(BeforeShared, Ct);

        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO users (id, username, normalized_username, email_confirmed, failed_sign_in_count, locale, is_enabled, created_at, last_activity_at)
            VALUES ('00000000-0000-7000-8000-000000000001', 'Owner', 'owner', false, 0, 'en', true, now(), now()),
                   ('00000000-0000-7000-8000-000000000002', 'Author', 'author', false, 0, 'en', true, now(), now());
            INSERT INTO wall_comments (id, wall_user_id, author_id, body, created_at)
            VALUES ('00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002', 'Kept', now());
            INSERT INTO moderation_reports (id, reporter_id, reported_user_id, target_type, target_key, reason, status, created_at)
            VALUES ('00000000-0000-7000-8000-0000000000f1', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002',
                    'wall_comment', '00000000-0000-7000-8000-0000000000c1', 'spam', 'open', now());
            """, Ct);

        await migrator.MigrateAsync(cancellationToken: Ct);

        var comment = await db.Comments.SingleAsync(Ct);
        Assert.Equal("Kept", comment.Body);
        Assert.NotNull(comment.WallUserId);
        Assert.Null(comment.GameId);
        Assert.Equal("comment", await db.ModerationReports.Select(r => r.TargetType).SingleAsync(Ct));
    }
}
