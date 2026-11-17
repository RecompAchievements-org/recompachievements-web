using Microsoft.EntityFrameworkCore;
using RecompAchievements.Api.Data;

namespace RecompAchievements.Api.Infrastructure;

internal static class Database
{
    public const string ConnectionStringName = "Database";

    /** Registers a pooled AppDbContext on PostgreSQL with snake_case names and no-tracking reads.
     *  The connection string is read when the first context is created, so tests can override it.
    **/
    public static IServiceCollection AddDatabase(this IServiceCollection services)
    {
        services.AddDbContextPool<AppDbContext>((provider, options) =>
        {
            var connectionString = provider.GetRequiredService<IConfiguration>()
                .GetConnectionString(ConnectionStringName)
                ?? throw new InvalidOperationException(
                    $"Connection string '{ConnectionStringName}' is missing. Set ConnectionStrings__{ConnectionStringName}.");

            options
                .UseNpgsql(connectionString)
                .UseSnakeCaseNamingConvention()
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
        });

        return services;
    }

    // Applies pending migrations at startup in Development only; production runs a migration bundle.
    public static async Task MigrateDatabaseInDevelopmentAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<AppDbContext>().Database;

        // With no migrations yet there is nothing to apply (and EF would log a failed history query).
        if (database.GetMigrations().Any())
        {
            await database.MigrateAsync();
        }
    }
}
