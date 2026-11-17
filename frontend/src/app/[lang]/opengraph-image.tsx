import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image generation can't read Tailwind tokens, so these mirror the values in globals.css
 *  (background, surface-raised, border, foreground, muted, accent, gold). Keep them in sync.
**/
const colors = {
  background: "#0a0c14",
  surfaceRaised: "#1a2033",
  border: "#262d44",
  foreground: "#e7e9f2",
  muted: "#9aa3ba",
  accent: "#8b7bff",
  gold: "#f5c04a",
};

const displayFont = readFile(join(process.cwd(), "assets/fonts/ChakraPetch-Bold.ttf"));

// Social preview card for every page in a locale (Discord, X, Slack, search results).
export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { home, metadata } = await loadMessages(lang);

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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <path
              d="M16 2 28 9v14l-12 7-12-7V9z"
              fill={colors.surfaceRaised}
              stroke={colors.accent}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M16 9l1.7 4.65 4.96.19-3.9 3.06 1.35 4.76L16 18.9l-4.11 2.76 1.35-4.76-3.9-3.06 4.96-.19z"
              fill={colors.gold}
            />
          </svg>
          <div style={{ display: "flex", fontFamily: "Chakra Petch", fontSize: 44 }}>
            Recomp<span style={{ color: colors.accent }}>Achievements</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontFamily: "Chakra Petch",
              fontSize: 80,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 1000,
            }}
          >
            {home.metaTitle}
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: colors.muted, maxWidth: 960 }}>
            {metadata.description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "10px 20px",
            border: `2px solid ${colors.border}`,
            borderRadius: 12,
            fontSize: 26,
            color: colors.muted,
          }}
        >
          {siteConfig.url.replace("https://", "")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Chakra Petch", data: await displayFont, style: "normal", weight: 700 }],
    },
  );
}
