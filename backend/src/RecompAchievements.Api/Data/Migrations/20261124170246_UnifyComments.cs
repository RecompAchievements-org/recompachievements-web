using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecompAchievements.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class UnifyComments : Migration
    {
        /** Renames wall_comments to the shared comments table, so existing wall comments are kept, and
         *  lets a comment belong to a game page instead of a wall. Hand-written: EF would drop and
         *  recreate the table.
        **/
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "fk_wall_comments_users_author_id", table: "wall_comments");
            migrationBuilder.DropForeignKey(name: "fk_wall_comments_users_wall_user_id", table: "wall_comments");
            migrationBuilder.DropPrimaryKey(name: "pk_wall_comments", table: "wall_comments");
            migrationBuilder.RenameTable(name: "wall_comments", newName: "comments");
            migrationBuilder.RenameIndex(name: "ix_wall_comments_author_id_created_at", table: "comments", newName: "ix_comments_author_id_created_at");
            migrationBuilder.RenameIndex(name: "ix_wall_comments_wall_user_id_id", table: "comments", newName: "ix_comments_wall_user_id_id");
            migrationBuilder.AddPrimaryKey(name: "pk_comments", table: "comments", column: "id");

            migrationBuilder.AlterColumn<Guid>(
                name: "wall_user_id",
                table: "comments",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(name: "game_id", table: "comments", type: "uuid", nullable: true);
            migrationBuilder.AddCheckConstraint(name: "ck_comments_one_thread", table: "comments", sql: "num_nonnulls(wall_user_id, game_id) = 1");
            migrationBuilder.CreateIndex(name: "ix_comments_game_id_id", table: "comments", columns: ["game_id", "id"]);

            migrationBuilder.AddForeignKey(
                name: "fk_comments_users_author_id",
                table: "comments",
                column: "author_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(
                name: "fk_comments_users_wall_user_id",
                table: "comments",
                column: "wall_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(
                name: "fk_comments_games_game_id",
                table: "comments",
                column: "game_id",
                principalTable: "games",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            // Reports on wall comments now use the shared comment target.
            migrationBuilder.Sql("UPDATE moderation_reports SET target_type = 'comment' WHERE target_type = 'wall_comment';");
        }

        // Game comments can't exist without the shared table, so going back removes them.
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE moderation_reports SET target_type = 'wall_comment' WHERE target_type = 'comment';");
            migrationBuilder.Sql("DELETE FROM comments WHERE game_id IS NOT NULL;");
            migrationBuilder.DropForeignKey(name: "fk_comments_games_game_id", table: "comments");
            migrationBuilder.DropForeignKey(name: "fk_comments_users_author_id", table: "comments");
            migrationBuilder.DropForeignKey(name: "fk_comments_users_wall_user_id", table: "comments");
            migrationBuilder.DropCheckConstraint(name: "ck_comments_one_thread", table: "comments");
            migrationBuilder.DropIndex(name: "ix_comments_game_id_id", table: "comments");
            migrationBuilder.DropColumn(name: "game_id", table: "comments");

            migrationBuilder.AlterColumn<Guid>(
                name: "wall_user_id",
                table: "comments",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropPrimaryKey(name: "pk_comments", table: "comments");
            migrationBuilder.RenameTable(name: "comments", newName: "wall_comments");
            migrationBuilder.RenameIndex(name: "ix_comments_author_id_created_at", table: "wall_comments", newName: "ix_wall_comments_author_id_created_at");
            migrationBuilder.RenameIndex(name: "ix_comments_wall_user_id_id", table: "wall_comments", newName: "ix_wall_comments_wall_user_id_id");
            migrationBuilder.AddPrimaryKey(name: "pk_wall_comments", table: "wall_comments", column: "id");
            migrationBuilder.AddForeignKey(
                name: "fk_wall_comments_users_author_id",
                table: "wall_comments",
                column: "author_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
            migrationBuilder.AddForeignKey(
                name: "fk_wall_comments_users_wall_user_id",
                table: "wall_comments",
                column: "wall_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
