using RecompAchievements.Api.Features.Health;
using RecompAchievements.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.ConfigureServerLimits();
builder.Services
    .AddDatabase()
    .AddErrorHandling()
    .AddApiRateLimiting()
    .AddProxySupport(builder.Configuration)
    .AddHealth()
    .AddOpenApi();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseErrorHandling();
app.UseSecurityHeaders();
app.UseRateLimiter();

app.MapApiDocumentationInDevelopment();
app.MapHealthEndpoints();

await app.MigrateDatabaseInDevelopmentAsync();
await app.RunAsync();
