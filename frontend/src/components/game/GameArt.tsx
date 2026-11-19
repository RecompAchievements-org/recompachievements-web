import Image from "next/image";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/lib/cx";
import type { GameImage } from "@/lib/api/games";
import { GeneratedArt } from "./GeneratedArt";

/** Art for a featured slide: the game's approved landscape image when it has one (filling its
 *  container; the slide shows its credit with ImageCredit), otherwise generated art.
**/
export function GameArt({
  game,
  sizes,
  priority = false,
  className,
}: {
  game: { slug: string; title: string; originalPlatform: string; heroImage: GameImage | null };
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!game.heroImage) {
    return <GeneratedArt slug={game.slug} title={game.title} originalPlatform={game.originalPlatform} variant="wide" className={className} />;
  }

  return (
    <div className={cx("relative overflow-hidden", className)}>
      {/** The pulsing placeholder sits behind the image, which covers it as soon as it has loaded. **/}
      <Skeleton className="absolute inset-0 rounded-none" />
      <Image src={game.heroImage.url} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
