import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { loadMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { SocialLogo, socialColors as colors, socialImageFonts, socialImageSize } from "@/lib/socialImage";

export const alt = siteConfig.name;
export const size = socialImageSize;
export const contentType = "image/png";

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
        <SocialLogo />

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
    { ...size, fonts: await socialImageFonts() },
  );
}
