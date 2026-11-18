using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecompAchievements.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAlphaSignups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "alpha_signups",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    nickname = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    platforms = table.Column<string[]>(type: "text[]", nullable: false),
                    recomps = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    locale = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    confirmation_token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    confirmation_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    confirmation_sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    consented_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    confirmed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_alpha_signups", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_alpha_signups_confirmation_sent_at",
                table: "alpha_signups",
                column: "confirmation_sent_at");

            migrationBuilder.CreateIndex(
                name: "ix_alpha_signups_confirmation_token_hash",
                table: "alpha_signups",
                column: "confirmation_token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_alpha_signups_email",
                table: "alpha_signups",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "alpha_signups");
        }
    }
}
