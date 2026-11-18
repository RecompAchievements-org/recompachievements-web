using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Features.AlphaSignups;

namespace RecompAchievements.Api.Data;

/** The application's EF Core database context. Entity configurations live next to their feature
 *  (Features/<Feature>/) and are picked up by ApplyConfigurationsFromAssembly.
**/
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AlphaSignup> AlphaSignups => Set<AlphaSignup>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
