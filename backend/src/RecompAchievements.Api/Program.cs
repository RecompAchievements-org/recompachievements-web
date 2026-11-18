using RecompAchievements.Api.Features.AlphaSignups;
using RecompAchievements.Api.Features.Health;
using RecompAchievements.Api.Infrastructure;
using RecompAchievements.Api.Infrastructure.Email;

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
    .AddHealth()
    .AddOpenApi()
    .AddValidation()
    .AddSingleton(TimeProvider.System)
    .AddHostedService<ExpiredSignupCleanup>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseErrorHandling();
app.UseSecurityHeaders();
app.UseRateLimiter();
app.UseInternalKey("/api/v1");

app.MapApiDocumentationInDevelopment();
app.MapHealthEndpoints();

// Public web API, called only by the website's server code (internal key required).
app.MapGroup("/api/v1")
    .MapAlphaSignupEndpoints();

await app.ApplyMigrationsIfEnabledAsync();
await app.RunAsync();
