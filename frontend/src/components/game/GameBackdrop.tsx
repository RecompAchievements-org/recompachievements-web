import { cx } from "@/lib/cx";
import { FadeInImage } from "./FadeInImage";

/** Game background art behind the top of a page: slightly blurred, dimmed, and fading into the
 *  page color at its bottom, so the content scrolls over it. Decorative (credited where the art is
 *  listed). It's pinned to the top of the document, so it scrolls away with the page.
 *
 *  Takes several images and shows the one at `active`; switching crossfades between them. A null
 *  entry isn't loaded yet (the home slider mounts a layer the first time its slide shows) or has no
 *  art. Each image also fades in once it has loaded. `eager` is for a page whose largest image is
 *  this backdrop (the game page).
**/
export function GameBackdrop({
  images,
  active = 0,
  eager = false,
  className = "h-[28rem] sm:h-[36rem]",
}: {
  images: (string | null)[];
  active?: number;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden", className)}>
      {images.map((url, index) =>
        url ? (
          <div
            key={index}
            className={cx("absolute inset-0 transition-opacity duration-700", index === active ? "opacity-100" : "opacity-0")}
          >
            <FadeInImage
              src={url}
              alt=""
              fill
              sizes="100vw"
              quality={60}
              loading={eager ? "eager" : undefined}
              fetchPriority={eager ? "high" : undefined}
              shownClassName="opacity-45"
              className="scale-110 object-cover blur-sm"
            />
          </div>
        ) : null,
      )}
      <div className="absolute inset-0 bg-linear-to-b from-background/50 via-background/75 to-background" />
    </div>
  );
}
