import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "gold"
  | "success"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border-strong text-muted",
  accent: "border-accent/40 text-accent",
  gold: "border-gold/40 text-gold",
  success: "border-success/40 text-success",
  common: "border-rarity-common/40 text-rarity-common",
  uncommon: "border-rarity-uncommon/40 text-rarity-uncommon",
  rare: "border-rarity-rare/40 text-rarity-rare",
  epic: "border-rarity-epic/40 text-rarity-epic",
  legendary: "border-rarity-legendary/40 text-rarity-legendary",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: { tone?: BadgeTone } & ComponentProps<"span">) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border bg-surface-raised px-2 py-0.5",
        "text-xs font-semibold tracking-wide uppercase",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
