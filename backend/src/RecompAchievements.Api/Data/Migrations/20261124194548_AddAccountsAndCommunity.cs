#pragma warning disable CA1861 // Generated migration: constant column arrays run once at startup.
using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecompAchievements.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsAndCommunity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "forum_categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    admin_only = table.Column<bool>(type: "boolean", nullable: false),
                    comments_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "jsonb", nullable: false),
                    name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_categories", x => x.id);
                });

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

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    normalized_username = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    email_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    discord_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    github_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    failed_sign_in_count = table.Column<int>(type: "integer", nullable: false),
                    locked_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    locale = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "player"),
                    muted_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    avatar_key = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    avatar_terms_accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_activity_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "comments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    wall_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    game_id = table.Column<Guid>(type: "uuid", nullable: true),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_comments", x => x.id);
                    table.CheckConstraint("ck_comments_one_thread", "num_nonnulls(wall_user_id, game_id) = 1");
                    table.ForeignKey(
                        name: "fk_comments_games_game_id",
                        column: x => x.game_id,
                        principalTable: "games",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_comments_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_comments_users_wall_user_id",
                        column: x => x.wall_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "forum_posts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    pinned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    body = table.Column<string>(type: "jsonb", nullable: false),
                    title = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_forum_posts", x => x.id);
                    table.ForeignKey(
                        name: "fk_forum_posts_forum_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "forum_categories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_forum_posts_users_author_id",
                        column: x => x.author_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "user_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_sessions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_comments_author_id_created_at",
                table: "comments",
                columns: new[] { "author_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_comments_game_id_id",
                table: "comments",
                columns: new[] { "game_id", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_comments_wall_user_id_id",
                table: "comments",
                columns: new[] { "wall_user_id", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_forum_categories_key",
                table: "forum_categories",
                column: "key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_author_id",
                table: "forum_posts",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_category_id_pinned_at",
                table: "forum_posts",
                columns: new[] { "category_id", "pinned_at" },
                filter: "pinned_at IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_category_id_slug",
                table: "forum_posts",
                columns: new[] { "category_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_forum_posts_category_id_status_published_at",
                table: "forum_posts",
                columns: new[] { "category_id", "status", "published_at" });

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

            migrationBuilder.CreateIndex(
                name: "ix_user_sessions_expires_at",
                table: "user_sessions",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_user_sessions_token_hash",
                table: "user_sessions",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_sessions_user_id",
                table: "user_sessions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_user_tokens_created_at",
                table: "user_tokens",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_user_tokens_token_hash",
                table: "user_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_tokens_user_id_purpose",
                table: "user_tokens",
                columns: new[] { "user_id", "purpose" });

            migrationBuilder.CreateIndex(
                name: "ix_users_discord_id",
                table: "users",
                column: "discord_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_github_id",
                table: "users",
                column: "github_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_normalized_username",
                table: "users",
                column: "normalized_username",
                unique: true);

            // The News category and the pinned Alpha v1.0 announcement; admins can edit the post afterwards.
            migrationBuilder.Sql(@"
                INSERT INTO forum_categories (id, key, name, description, admin_only, comments_enabled, display_order)
                VALUES ('019ab7a0-0000-7000-8000-000000000001', 'news',
                        jsonb_build_object('En', 'News', 'Es', 'Noticias', 'Pt', 'Notícias'),
                        jsonb_build_object('En', 'Official announcements about RecompAchievements: releases, features, and project news.',
                                           'Es', 'Anuncios oficiales de RecompAchievements: versiones, funciones y noticias del proyecto.',
                                           'Pt', 'Anúncios oficiais do RecompAchievements: versões, recursos e notícias do projeto.'),
                        true, false, 0);

                INSERT INTO forum_posts (id, category_id, slug, title, body, status, author_id, created_at, published_at, edited_at)
                VALUES ('019ab7a0-0000-7000-8000-000000000002', '019ab7a0-0000-7000-8000-000000000001', 'alpha-v1-0-is-live',
                        jsonb_build_object('En', 'RecompAchievements Alpha v1.0 is live',
                                           'Es', 'RecompAchievements Alpha v1.0 ya está disponible',
                                           'Pt', 'RecompAchievements Alpha v1.0 já está no ar'),
                        jsonb_build_object('En', $seed$RecompAchievements Alpha v1.0 is here: the first release of our community home for achievements in native recomps and PC ports. We're still in **alpha**, so expect changes along the way, and please tell us what you think.

## What's New

- **Player accounts:** sign up with email, Discord, or GitHub, and confirm your email to be ready for achievements.
- **Public profiles:** choose a profile photo and share your profile link.
- **Comments:** leave messages on player walls, and share tips, bugs, and setup notes on game pages.
- **Game directory:** browse recomps and their preview achievement sets, starting with bbport.
- **Three languages:** English, Spanish, and Portuguese.
- **Community rules:** read our [community rules](/rules), and use the **Report** button if something breaks them.

## Previews for Now

Some parts of profiles are placeholders while we build them: badges, medals, completion progress, points, Elo, and rankings show sample data or empty values. They'll become real one by one in upcoming updates, so nothing you see there is real progress yet.

## What's Next

- The developer portal, where recomp developers will manage their achievement sets.
- The `librecompachievements` SDK, which lets recomps unlock achievements.
- Our launch integration with bbport.

## Follow Along

Keep an eye on this News section, follow the project on [GitHub](https://github.com/RecompAchievements-org), and find us on [Reddit](https://www.reddit.com/user/RecompAchievements/) and [YouTube](https://www.youtube.com/@RecompAchievements).

Thanks for being here early!$seed$, 'Es', $seed$Ya está aquí RecompAchievements Alpha v1.0: la primera versión de nuestra comunidad de logros para recomps nativos y ports de PC. Seguimos en **alfa**, así que habrá cambios por el camino. Cuéntanos qué te parece.

## Novedades

- **Cuentas de jugador:** regístrate con correo, Discord o GitHub, y confirma tu correo para estar listo para los logros.
- **Perfiles públicos:** elige una foto de perfil y comparte el enlace de tu perfil.
- **Comentarios:** deja mensajes en los muros de otros jugadores y comparte consejos, errores y configuraciones en las páginas de los juegos.
- **Directorio de juegos:** explora los recomps y sus conjuntos de logros en vista previa, empezando por bbport.
- **Tres idiomas:** inglés, español y portugués.
- **Normas de la comunidad:** lee nuestras [normas de la comunidad](/rules) y usa el botón **Reportar** si algo las incumple.

## Vistas previas por ahora

Algunas partes de los perfiles son provisionales mientras las construimos: insignias, medallas, progreso de compleción, puntos, Elo y clasificaciones muestran datos de ejemplo o valores vacíos. Se irán haciendo reales una a una en próximas actualizaciones, así que nada de lo que ves ahí es progreso real todavía.

## Lo que viene

- El portal para desarrolladores, donde quienes crean recomps gestionarán sus conjuntos de logros.
- El SDK `librecompachievements`, que permite a los recomps desbloquear logros.
- Nuestra integración de lanzamiento con bbport.

## Síguenos

Mantente atento a esta sección de Noticias, sigue el proyecto en [GitHub](https://github.com/RecompAchievements-org) y encuéntranos en [Reddit](https://www.reddit.com/user/RecompAchievements/) y [YouTube](https://www.youtube.com/@RecompAchievements).

¡Gracias por llegar tan pronto!$seed$, 'Pt', $seed$O RecompAchievements Alpha v1.0 chegou: a primeira versão da nossa comunidade de conquistas para recomps nativos e ports de PC. Ainda estamos em **alfa**, então espere mudanças pelo caminho e conte para a gente o que achou.

## Novidades

- **Contas de jogador:** cadastre-se com e-mail, Discord ou GitHub e confirme seu e-mail para ficar pronto para as conquistas.
- **Perfis públicos:** escolha uma foto de perfil e compartilhe o link do seu perfil.
- **Comentários:** deixe mensagens nos murais de outros jogadores e compartilhe dicas, bugs e configurações nas páginas dos jogos.
- **Diretório de jogos:** explore os recomps e seus conjuntos de conquistas em prévia, começando pelo bbport.
- **Três idiomas:** inglês, espanhol e português.
- **Regras da comunidade:** leia nossas [regras da comunidade](/rules) e use o botão **Denunciar** se algo violá-las.

## Prévias por enquanto

Algumas partes dos perfis são provisórias enquanto as construímos: insígnias, medalhas, progresso de conclusão, pontos, Elo e rankings mostram dados de exemplo ou valores vazios. Elas vão se tornar reais uma a uma nas próximas atualizações, então nada do que você vê ali é progresso real ainda.

## O que vem por aí

- O portal para desenvolvedores, onde quem cria recomps vai gerenciar seus conjuntos de conquistas.
- O SDK `librecompachievements`, que permite aos recomps desbloquear conquistas.
- Nossa integração de lançamento com o bbport.

## Acompanhe

Fique de olho nesta seção de Notícias, siga o projeto no [GitHub](https://github.com/RecompAchievements-org) e encontre a gente no [Reddit](https://www.reddit.com/user/RecompAchievements/) e no [YouTube](https://www.youtube.com/@RecompAchievements).

Obrigado por chegar cedo!$seed$),
                        'published', NULL, now(), now(), NULL);

                UPDATE forum_posts SET pinned_at = published_at WHERE id = '019ab7a0-0000-7000-8000-000000000002';
                ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comments");

            migrationBuilder.DropTable(
                name: "forum_posts");

            migrationBuilder.DropTable(
                name: "moderation_actions");

            migrationBuilder.DropTable(
                name: "moderation_reports");

            migrationBuilder.DropTable(
                name: "user_sessions");

            migrationBuilder.DropTable(
                name: "user_tokens");

            migrationBuilder.DropTable(
                name: "forum_categories");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
