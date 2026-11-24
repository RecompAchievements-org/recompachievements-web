using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RecompAchievements.Api.Features.Accounts;

/** A player account. It has up to three ways to be identified: an email, a Discord ID, and a GitHub
 *  ID, each unique where set. An account created through Discord or GitHub without a verified email
 *  has no email until the user adds and confirms one; only accounts with a confirmed email can
 *  collect achievements. PasswordHash is null until a password is set through the emailed link.
 *  A disabled account (IsEnabled false) keeps its data and identities but can't be used at all.
**/
public sealed class User
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Username { get; set; }
    public required string NormalizedUsername { get; set; }
    public string? Email { get; set; }
    public bool EmailConfirmed { get; set; }
    public string? DiscordId { get; set; }
    public string? GithubId { get; set; }
    public string? PasswordHash { get; set; }
    public int FailedSignInCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public required string Locale { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string Role { get; set; } = UserRoles.Player;

    // Null means not muted. A mute ends by itself when this time passes.
    public DateTimeOffset? MutedUntil { get; set; }

    // The storage prefix of the profile photo; null shows the placeholder.
    public string? AvatarKey { get; set; }
    public DateTimeOffset? AvatarTermsAcceptedAt { get; set; }
    public DateTimeOffset CreatedAt { get; init; }

    // Null until the account is first edited; set by UserEditStamp.
    public DateTimeOffset? EditedAt { get; set; }

    // Starts at creation; moved forward by Sessions. It outlives sessions, and isn't an edit.
    public required DateTimeOffset LastActivityAt { get; set; }

    public bool CanCollectAchievements => IsEnabled && Email is not null && EmailConfirmed;

    public bool IsMutedAt(DateTimeOffset now) => MutedUntil > now;
}

internal static class UserRoles
{
    public const string Player = "player";
    public const string Moderator = "moderator";
    public const string Admin = "admin";
}

// A signed-in browser. The website holds the token; only its SHA-256 hash is stored.
public sealed class UserSession
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid UserId { get; init; }
    public required byte[] TokenHash { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

/** A single-use link sent by email: confirming an email (Email is the address being confirmed) or
 *  setting a password. Deleted when used or when it expires.
**/
public sealed class UserToken
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public Guid UserId { get; init; }
    public required string Purpose { get; init; }
    public string? Email { get; init; }
    public required byte[] TokenHash { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset ExpiresAt { get; init; }
}

internal static class UserTokenPurpose
{
    public const string ConfirmEmail = "confirm_email";
    public const string SetPassword = "set_password";
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(user => user.Id);
        builder.Property(user => user.Username).HasMaxLength(24);
        builder.Property(user => user.NormalizedUsername).HasMaxLength(24);
        builder.Property(user => user.Email).HasMaxLength(254);
        builder.Property(user => user.DiscordId).HasMaxLength(32);
        builder.Property(user => user.GithubId).HasMaxLength(32);
        builder.Property(user => user.PasswordHash).HasMaxLength(256);
        builder.Property(user => user.Locale).HasMaxLength(5);
        builder.Property(user => user.Role).HasMaxLength(16).HasDefaultValue(UserRoles.Player);
        builder.Property(user => user.AvatarKey).HasMaxLength(96);
        builder.Ignore(user => user.CanCollectAchievements);

        // PostgreSQL allows many NULLs in a unique index, so each identity is unique only where set.
        builder.HasIndex(user => user.NormalizedUsername).IsUnique();
        builder.HasIndex(user => user.Email).IsUnique();
        builder.HasIndex(user => user.DiscordId).IsUnique();
        builder.HasIndex(user => user.GithubId).IsUnique();
    }
}

internal sealed class UserSessionConfiguration : IEntityTypeConfiguration<UserSession>
{
    public void Configure(EntityTypeBuilder<UserSession> builder)
    {
        builder.HasKey(session => session.Id);
        builder.HasIndex(session => session.TokenHash).IsUnique();
        builder.HasIndex(session => session.ExpiresAt);
        builder.HasOne<User>().WithMany().HasForeignKey(session => session.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class UserTokenConfiguration : IEntityTypeConfiguration<UserToken>
{
    public void Configure(EntityTypeBuilder<UserToken> builder)
    {
        builder.HasKey(token => token.Id);
        builder.Property(token => token.Purpose).HasMaxLength(16);
        builder.Property(token => token.Email).HasMaxLength(254);
        builder.HasIndex(token => token.TokenHash).IsUnique();
        builder.HasIndex(token => new { token.UserId, token.Purpose });
        builder.HasIndex(token => token.CreatedAt);
        builder.HasOne<User>().WithMany().HasForeignKey(token => token.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
