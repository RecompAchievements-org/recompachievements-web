import { ExternalLink } from "@/components/ui/ExternalLink";
import { cx } from "@/lib/cx";
import type { GameImage } from "@/lib/api/games";

// Credit line required for every approved image (project screenshots and our own captures).
export function ImageCredit({ image, prefix, className }: { image: GameImage; prefix: string; className?: string }) {
  return (
    <p className={cx("text-xs text-subtle", className)}>
      {prefix}{" "}
      {image.sourceUrl ? (
        <ExternalLink href={image.sourceUrl} className="underline hover:text-foreground">
          {image.credit}
        </ExternalLink>
      ) : (
        image.credit
      )}
    </p>
  );
}
