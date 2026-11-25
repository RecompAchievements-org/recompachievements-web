import Link from "next/link";
import { cx } from "@/lib/cx";

/** The current release, linking to its announcement, in gold with a pulsing dot (the pulse stops
 *  for visitors who prefer reduced motion). The header always shows it: beside the logo on wide
 *  screens, and in a strip below the header row where the row has no room.
**/
// The caller sets its display (e.g. "inline-flex", or "hidden lg:inline-flex"), so each spot decides where it shows.
export function ReleaseBadge({ href, label, className }: { href: string; label: string; className: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "shrink-0 items-center gap-2 rounded-md border border-gold/40 bg-surface-raised px-2 py-1 text-xs font-semibold tracking-wide whitespace-nowrap text-gold uppercase transition-colors hover:border-gold",
        className,
      )}
    >
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-gold" />
      </span>
      {label}
    </Link>
  );
}
