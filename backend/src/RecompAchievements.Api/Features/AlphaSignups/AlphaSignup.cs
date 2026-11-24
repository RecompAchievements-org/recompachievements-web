using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecompAchievements.Api.Features.Accounts;

namespace RecompAchievements.Api.Features.AlphaSignups;

/** A person who joined the earlier alpha list. Confirmed sign-ups are migrated to player accounts
 *  (AlphaSignupMigration): MigratedAt marks the sign-up as handled, MigratedUserId is the account
 *  created for it (null when the email already had one), and InviteSentAt is when its welcome email
 *  went out. The row stays, so an account with the same confirmed email is still an alpha tester.
**/
public sealed class AlphaSignup
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Email { get; init; }
    public required string Nickname { get; set; }
    public required string[] Platforms { get; set; }
    public string? Recomps { get; set; }
    public required string Locale { get; set; }
    public string Status { get; set; } = AlphaSignupStatus.Pending;
    public required byte[] ConfirmationTokenHash { get; set; }
    public DateTimeOffset ConfirmationExpiresAt { get; set; }
    public DateTimeOffset? ConfirmationSentAt { get; set; }
    public DateTimeOffset ConsentedAt { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset? MigratedAt { get; set; }
    public Guid? MigratedUserId { get; set; }
    public DateTimeOffset? InviteSentAt { get; set; }
}

internal static class AlphaSignupStatus
{
    public const string Pending = "pending";
    public const string Confirmed = "confirmed";
}

internal sealed class AlphaSignupConfiguration : IEntityTypeConfiguration<AlphaSignup>
{
    public void Configure(EntityTypeBuilder<AlphaSignup> builder)
    {
        builder.HasKey(signup => signup.Id);
        builder.Property(signup => signup.Email).HasMaxLength(254);
        builder.Property(signup => signup.Nickname).HasMaxLength(32);
        builder.Property(signup => signup.Recomps).HasMaxLength(200);
        builder.Property(signup => signup.Locale).HasMaxLength(5);
        builder.Property(signup => signup.Status).HasMaxLength(16);
        builder.HasIndex(signup => signup.Email).IsUnique();
        builder.HasIndex(signup => signup.ConfirmationTokenHash).IsUnique();
        builder.HasIndex(signup => signup.ConfirmationSentAt);
        builder.HasOne<User>().WithMany().HasForeignKey(signup => signup.MigratedUserId).OnDelete(DeleteBehavior.SetNull);
    }
}
