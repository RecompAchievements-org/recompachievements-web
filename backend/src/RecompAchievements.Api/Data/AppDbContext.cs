using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Games;
using RecompAchievements.Api.Features.Moderation;
using RecompAchievements.Api.Features.Walls;

namespace RecompAchievements.Api.Data;

/** The application's EF Core database context. Entity configurations live next to their feature
 *  (Features/<Feature>/) and are picked up by ApplyConfigurationsFromAssembly.
**/
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AlphaSignup> AlphaSignups => Set<AlphaSignup>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<AchievementSet> AchievementSets => Set<AchievementSet>();
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<WallComment> WallComments => Set<WallComment>();
    public DbSet<ModerationReport> ModerationReports => Set<ModerationReport>();
    public DbSet<ModerationAction> ModerationActions => Set<ModerationAction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
