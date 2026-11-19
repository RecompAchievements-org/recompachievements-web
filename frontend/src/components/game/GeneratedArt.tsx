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
 *  to it. "card" is 16:9 (game cards), "portrait" is a 2:3 cover (game page header), "wide" fills
 *  the featured slider, and "thumb" is the details card's square. "wide" and "thumb" leave out the
 *  title, and "portrait" the console, because the page already shows them beside the art.
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
  variant?: "card" | "portrait" | "wide" | "thumb";
  className?: string;
}) {
  if (variant === "thumb") {
    return (
      <div
        aria-hidden="true"
        className={cx(
          "grid aspect-square place-items-center overflow-hidden rounded-lg border border-border bg-linear-to-br font-display text-3xl text-foreground/40",
          gradientFor(slug),
          className,
        )}
      >
        ★
      </div>
    );
  }

  const wide = variant === "wide";
  const portrait = variant === "portrait";
  return (
    <div
      aria-hidden="true"
      className={cx(
        "relative flex flex-col overflow-hidden bg-linear-to-br",
        portrait ? "justify-end" : "justify-between",
        wide && "p-6 sm:p-10",
        variant === "card" && "aspect-video rounded-lg border border-border p-4",
        portrait && "aspect-[2/3] rounded-xl border border-border p-4 sm:p-5",
        gradientFor(slug),
        className,
      )}
    >
      {!portrait && (
        <span className="self-start rounded-md border border-border-strong bg-background/60 px-2 py-0.5 font-mono text-xs text-muted">
          {consoleName(originalPlatform)}
        </span>
      )}
      {!wide && (
        <span
          translate="no"
          className={cx(
            "relative font-display leading-tight font-bold text-balance text-foreground",
            portrait ? "text-xl wrap-anywhere sm:text-2xl" : "text-2xl",
          )}
        >
          {title}
        </span>
      )}
      <span
        className={cx(
          "pointer-events-none absolute font-display",
          wide && "-right-8 -bottom-20 text-[18rem] leading-none text-foreground/10",
          portrait && "-right-10 -bottom-10 text-[12rem] leading-none text-foreground/5",
          variant === "card" && "-right-4 -bottom-6 text-8xl text-foreground/5",
        )}
      >
        ★
      </span>
    </div>
  );
}
