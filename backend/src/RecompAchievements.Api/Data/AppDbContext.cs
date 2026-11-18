using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Games;

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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
