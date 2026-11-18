import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { consoleName } from "@/components/game/names";
import { isLocale } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { loadMessages } from "@/i18n/server";
import { getGame } from "@/lib/api/games";
import { siteConfig } from "@/lib/site";
import { SocialLogo, socialColors as colors, socialImageFonts, socialImageSize } from "@/lib/socialImage";

export const alt = siteConfig.name;
export const size = socialImageSize;
export const contentType = "image/png";

// Social preview card for a game page: title, original console, and achievement totals.
export default async function GameOpenGraphImage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const game = await getGame(slug, lang);
  if (!game) notFound();
  const { games, achievement } = await loadMessages(lang);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: colors.background,
          backgroundImage: `radial-gradient(circle at 85% 15%, ${colors.accent}33, transparent 45%)`,
          color: colors.foreground,
        }}
      >
        <SocialLogo />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 30, color: colors.muted }}>{consoleName(game.originalPlatform)}</div>
          <div style={{ fontFamily: "Chakra Petch", fontSize: 84, lineHeight: 1.05, letterSpacing: -1, maxWidth: 1040 }}>
            {game.title}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 30 }}>
          <div style={{ display: "flex", padding: "10px 20px", border: `2px solid ${colors.border}`, borderRadius: 12, color: colors.gold }}>
            {plural(lang, game.coreSet.achievementCount, games.achievementCount)}
          </div>
          <div style={{ display: "flex", padding: "10px 20px", border: `2px solid ${colors.border}`, borderRadius: 12, color: colors.muted }}>
            {plural(lang, game.coreSet.totalPoints, achievement.points)}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await socialImageFonts() },
  );
}
