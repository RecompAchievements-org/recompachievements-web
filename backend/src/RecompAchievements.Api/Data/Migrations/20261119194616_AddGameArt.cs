using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecompAchievements.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGameArt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "hero_image",
                table: "games",
                newName: "art");

            migrationBuilder.AddColumn<int>(
                name: "steam_grid_db_id",
                table: "games",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "steam_grid_db_id",
                table: "games");

            migrationBuilder.RenameColumn(
                name: "art",
                table: "games",
                newName: "hero_image");
        }
    }
}
