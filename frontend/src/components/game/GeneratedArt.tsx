import { cx } from "@/lib/cx";
import { consoleName } from "./names";

// Theme-token gradients; a game always gets the same one, picked from its slug.
const gradients = [
  "from-accent/45 via-surface-raised to-rarity-epic/25",
  "from-rarity-rare/40 via-surface-raised to-accent/25",
  "from-rarity-uncommon/30 via-surface-raised to-rarity-rare/30",
  "from-rarity-legendary/30 via-surface-raised to-accent/30",
];

function gradientFor(slug: string) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return gradients[hash % gradients.length];
}

/** Generated art for games without an approved image: a gradient in the site's colors with the
 *  game's title and original console. Decorative, because the title is always shown as text next
 *  to it. "wide" is the larger version used in the featured slider, where the title is already
 *  shown beside the art, so it shows only the console and the star motif.
**/
export function GeneratedArt({
  slug,
  title,
  originalPlatform,
  variant = "card",
  className,
}: {
  slug: string;
  title: string;
  originalPlatform: string;
  variant?: "card" | "wide";
  className?: string;
}) {
  const wide = variant === "wide";
  return (
    <div
      aria-hidden="true"
      className={cx(
        "relative flex flex-col justify-between overflow-hidden bg-linear-to-br",
        wide ? "p-6 sm:p-10" : "aspect-video rounded-lg border border-border p-4",
        gradientFor(slug),
        className,
      )}
    >
      <span className="self-start rounded-md border border-border-strong bg-background/60 px-2 py-0.5 font-mono text-xs text-muted">
        {consoleName(originalPlatform)}
      </span>
      {!wide && (
        <span translate="no" className="relative font-display text-2xl leading-tight font-bold text-balance text-foreground">
          {title}
        </span>
      )}
      <span
        className={cx(
          "pointer-events-none absolute font-display",
          wide ? "-right-8 -bottom-20 text-[18rem] leading-none text-foreground/10" : "-right-4 -bottom-6 text-8xl text-foreground/5",
        )}
      >
        ★
      </span>
    </div>
  );
}
