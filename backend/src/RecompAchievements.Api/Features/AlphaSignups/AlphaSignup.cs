using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RecompAchievements.Api.Features.AlphaSignups;

// A person who asked to test the alpha; only confirmed sign-ups are invited.
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
    }
}
