import { cx } from "@/lib/cx";

/** A pulsing placeholder block shown while content loads. Give it the real element's size and
 *  shape through className; the wrapper of a whole skeleton carries role="status" and the loading
 *  label. With reduced motion, globals.css stops the pulse and it stays a static block.
**/
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse rounded-md bg-surface-raised", className)} />;
}

/** Placeholder lines of text. className takes the real text's font size and line height, so each
 *  line is exactly as tall as the text it stands in for; widths sets each line's length. A line
 *  hidden at a breakpoint (e.g. "w-1/2 sm:hidden") takes no space there, for text that wraps more
 *  on phones.
**/
export function SkeletonText({ widths, className }: { widths: string[]; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("block", className)}>
      {widths.map((width, index) => (
        <span key={index} className="block">
          <span className={cx("inline-block h-[0.7em] animate-pulse rounded bg-surface-raised align-middle", width)} />
        </span>
      ))}
    </span>
  );
}
