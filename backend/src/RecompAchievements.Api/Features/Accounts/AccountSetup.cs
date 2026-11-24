using Microsoft.AspNetCore.Identity;

namespace RecompAchievements.Api.Features.Accounts;

internal static class AccountSetup
{
    /** Accounts use ASP.NET Core Identity's password hasher (part of the shared framework) and
     *  their own small stores for sessions and emailed links; Identity's cookies and EF stores
     *  aren't used.
    **/
    public static IServiceCollection AddAccounts(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<Sessions>();
        services.AddScoped<AccountLinks>();
        services.AddSingleton<PendingSignupTokens>();
        services.Configure<AlphaPhaseOptions>(configuration.GetSection("AlphaPhase"));
        services.AddOAuthProviders(configuration);
        services.AddHostedService<AccountCleanup>();
        return services;
    }
}
