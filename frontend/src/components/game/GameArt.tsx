import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/lib/cx";
import type { ArtImage } from "@/lib/api/games";
import { FadeInImage } from "./FadeInImage";
import { GeneratedArt } from "./GeneratedArt";

type Variant = "card" | "portrait" | "wide" | "thumb";

// The frame of each shape; "wide" fills whatever its container gives it.
const frames: Record<Variant, string> = {
  card: "aspect-video rounded-lg border border-border",
  portrait: "aspect-[2/3] rounded-xl border border-border",
  wide: "",
  thumb: "aspect-square rounded-lg border border-border",
};

/** A game's SteamGridDB image in the given shape when it has one, otherwise generated art. The
 *  image fades in over a pulsing Skeleton once loaded (FadeInImage). Pages credit every image they show (the
 *  slider's overlay and the game page's credits legend).
**/
export function GameArt({
  image,
  game,
  variant,
  sizes,
  loading,
  fetchPriority,
  className,
}: {
  image: ArtImage | null | undefined;
  game: { slug: string; title: string; originalPlatform: string };
  variant: Variant;
  sizes: string;
  // Above-the-fold images load eagerly; the page's main image also gets a high fetch priority.
  loading?: "eager";
  fetchPriority?: "high";
  className?: string;
}) {
  if (!image) {
    return (
      <GeneratedArt
        slug={game.slug}
        title={game.title}
        originalPlatform={game.originalPlatform}
        variant={variant}
        className={className}
      />
    );
  }

  return (
    <div className={cx("relative overflow-hidden", frames[variant], className)}>
      <Skeleton className="absolute inset-0 rounded-none" />
      <FadeInImage
        src={image.url}
        alt=""
        fill
        sizes={sizes}
        loading={loading}
        fetchPriority={fetchPriority}
        className="object-cover"
      />
    </div>
  );
}
