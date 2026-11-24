import type { ReactNode } from "react";
import type { RarityTier } from "@/lib/api/games";
import { cx } from "@/lib/cx";
import type { BadgeKind } from "./sampleBadges";

const rarityClasses: Record<RarityTier, string> = {
  common: "text-rarity-common",
  uncommon: "text-rarity-uncommon",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  legendary: "text-rarity-legendary",
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const glyphs: Record<BadgeKind, ReactNode> = {
  award: <path d="m24 14 3.3 7.2 7.7.8-5.8 5.2 1.7 7.8-6.9-4-6.9 4 1.7-7.8L13 22l7.7-.8z" fill="currentColor" />,
  recognition: <path d="m15.5 25.5 6 6 11-12.5" {...stroke} />,
  role: <path d="m24 14 9 3v8c0 6-4 9.5-9 11-5-1.5-9-5-9-11v-8z" fill="currentColor" />,
  event: <path d="M17 35V15m0 1h14l-3.5 5 3.5 5H17" {...stroke} />,
  contribution: <path d="m19 18-7 7 7 7m10-14 7 7-7 7" {...stroke} />,
};

/** The site's original badge: a tall hexagon with two ribbon tails, colored by rarity, with a glyph
 *  for its kind. The base is opaque so it stays readable over a profile photo. Decorative: its
 *  name and details come from the BadgeDetails button around it.
**/
export function BadgeIcon({ kind, rarity, className }: { kind: BadgeKind; rarity: RarityTier; className?: string }) {
  return (
    <svg viewBox="0 0 48 58" aria-hidden="true" className={cx("shrink-0", rarityClasses[rarity], className)}>
      <path d="M11 38.5 19.5 43.5 15.5 56.5 12 50.5 4.5 52zM37 38.5 28.5 43.5 32.5 56.5 36 50.5 43.5 52z" fill="currentColor" fillOpacity="0.6" />
      <path d="M24 2 43 13v24L24 48 5 37V13z" className="fill-surface" />
      <path d="M24 2 43 13v24L24 48 5 37V13z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {glyphs[kind]}
    </svg>
  );
}
