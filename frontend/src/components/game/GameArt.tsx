import Image from "next/image";
import { cx } from "@/lib/cx";
import type { GameImage } from "@/lib/api/games";
import { GeneratedArt } from "./GeneratedArt";

/** A game's approved image when it has one (filling its container), otherwise generated art.
 *  The caller shows the image's credit with ImageCredit.
**/
export function GameArt({
  game,
  variant = "card",
  sizes,
  priority = false,
  className,
}: {
  game: { slug: string; title: string; originalPlatform: string; heroImage: GameImage | null };
  variant?: "card" | "wide";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!game.heroImage) {
    return <GeneratedArt slug={game.slug} title={game.title} originalPlatform={game.originalPlatform} variant={variant} className={className} />;
  }

  return (
    <div className={cx("relative overflow-hidden", variant === "card" && "aspect-video rounded-lg border border-border", className)}>
      <Image src={game.heroImage.url} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
