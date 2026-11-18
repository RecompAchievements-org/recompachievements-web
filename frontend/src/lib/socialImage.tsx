import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared pieces of the social preview images (opengraph-image.tsx files), rendered with next/og.

export const socialImageSize = { width: 1200, height: 630 };

/** Image generation can't read Tailwind tokens, so these mirror the values in globals.css
 *  (background, surface-raised, border, foreground, muted, accent, gold). Keep them in sync.
**/
export const socialColors = {
  background: "#0a0c14",
  surfaceRaised: "#1a2033",
  border: "#262d44",
  foreground: "#e7e9f2",
  muted: "#9aa3ba",
  accent: "#8b7bff",
  gold: "#f5c04a",
};

const displayFont = readFile(join(process.cwd(), "assets/fonts/ChakraPetch-Bold.ttf"));

export async function socialImageFonts() {
  return [{ name: "Chakra Petch", data: await displayFont, style: "normal" as const, weight: 700 as const }];
}

// The logo mark and wordmark, as used at the top of every card.
export function SocialLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width="72" height="72" viewBox="0 0 32 32">
        <path
          d="M16 2 28 9v14l-12 7-12-7V9z"
          fill={socialColors.surfaceRaised}
          stroke={socialColors.accent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M16 9l1.7 4.65 4.96.19-3.9 3.06 1.35 4.76L16 18.9l-4.11 2.76 1.35-4.76-3.9-3.06 4.96-.19z"
          fill={socialColors.gold}
        />
      </svg>
      <div style={{ display: "flex", fontFamily: "Chakra Petch", fontSize: 44 }}>
        Recomp<span style={{ color: socialColors.accent }}>Achievements</span>
      </div>
    </div>
  );
}
