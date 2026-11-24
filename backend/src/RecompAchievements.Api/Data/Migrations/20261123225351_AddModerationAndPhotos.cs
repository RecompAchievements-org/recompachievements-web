#pragma warning disable CA1861 // Generated migration: constant column arrays run once at startup.
using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecompAchievements.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationAndPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_key",
                table: "users",
                type: "character varying(96)",
                maxLength: 96,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "avatar_terms_accepted_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "muted_until",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "users",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "player");

            migrationBuilder.CreateTable(
                name: "moderation_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    moderator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    report_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    evidence = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_moderation_actions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "moderation_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    target_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    reason = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    details = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    snapshot = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    resolved_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_moderation_reports", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_moderation_actions_created_at",
                table: "moderation_actions",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_moderation_actions_target_user_id_id",
                table: "moderation_actions",
                columns: new[] { "target_user_id", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_moderation_reports_reported_user_id_id",
                table: "moderation_reports",
                columns: new[] { "reported_user_id", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_moderation_reports_reporter_id_created_at",
                table: "moderation_reports",
                columns: new[] { "reporter_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_moderation_reports_reporter_id_target_type_target_key",
                table: "moderation_reports",
                columns: new[] { "reporter_id", "target_type", "target_key" },
                unique: true,
                filter: "status = 'open'");

            migrationBuilder.CreateIndex(
                name: "ix_moderation_reports_status_id",
                table: "moderation_reports",
                columns: new[] { "status", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "moderation_actions");

            migrationBuilder.DropTable(
                name: "moderation_reports");

            migrationBuilder.DropColumn(
                name: "avatar_key",
                table: "users");

            migrationBuilder.DropColumn(
                name: "avatar_terms_accepted_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "muted_until",
                table: "users");

            migrationBuilder.DropColumn(
                name: "role",
                table: "users");
        }
    }
}
