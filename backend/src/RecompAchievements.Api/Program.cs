using RecompAchievements.Api.Features.Accounts;
using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Games;
using RecompAchievements.Api.Features.Health;
using RecompAchievements.Api.Features.Moderation;
using RecompAchievements.Api.Features.Walls;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Email;
using RecompAchievements.Api.Infrastructure.Media;

var builder = WebApplication.CreateBuilder(args);

builder.ConfigureServerLimits();
builder.Services
    .AddDatabase()
    .AddJson()
    .AddErrorHandling()
    .AddApiRateLimiting(builder.Configuration)
    .AddProxySupport(builder.Configuration)
    .AddInternalKey(builder.Configuration)
    .AddEmailSending(builder.Configuration, builder.Environment)
    .AddGameArt(builder.Configuration)
    .AddMediaStorage(builder.Configuration, builder.Environment)
    .AddAccounts(builder.Configuration)
    .AddHealth()
    .AddOpenApi()
    .AddValidation()
    .AddSingleton(TimeProvider.System)
    .AddHostedService<ExpiredSignupCleanup>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseErrorHandling();
app.UseSecurityHeaders();
app.UseLocalMedia();
app.UseRateLimiter();
app.UseInternalKey("/api/v1");

app.MapApiDocumentationInDevelopment();
app.MapHealthEndpoints();

// Public web API, called only by the website's server code (internal key required).
app.MapGroup("/api/v1")
    .MapAlphaSignupEndpoints()
    .MapGameEndpoints()
    .MapAccountEndpoints()
    .MapPlayerEndpoints()
    .MapWallEndpoints()
    .MapPhotoEndpoints()
    .MapModerationEndpoints()
    .MapOAuthEndpoints();

await app.ApplyMigrationsIfEnabledAsync();
await app.ImportCatalogIfEnabledAsync();
await app.RunAsync();
