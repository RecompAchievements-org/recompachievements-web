using Microsoft.EntityFrameworkCore;

namespace RecompAchievements.Api.Data;

/** The application's EF Core database context. It has no tables yet; the first feature that adds
 *  one also adds OnModelCreating with ApplyConfigurationsFromAssembly (see backend/AGENTS.md).
**/
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options);
