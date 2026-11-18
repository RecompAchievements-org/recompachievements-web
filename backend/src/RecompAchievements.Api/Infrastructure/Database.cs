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

    /** Applies pending migrations at startup when "Database:ApplyMigrationsOnStartup" is true
     *  (Development, tests, and the single production instance). EF Core takes a database lock
     *  while migrating, so concurrent starts can't apply the same migration twice.
    **/
    public static async Task ApplyMigrationsIfEnabledAsync(this WebApplication app)
    {
        if (!app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }
}
