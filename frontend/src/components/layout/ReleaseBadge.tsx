import Link from "next/link";

/** The current release, shown beside the logo and linking to its announcement, in gold with a
 *  pulsing dot like the alpha sign-up badge (the pulse stops for visitors who prefer reduced
 *  motion). Hidden on narrow screens, where the header has no room; the home page's news card
 *  lists the same post there.
**/
export function ReleaseBadge({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="hidden shrink-0 items-center gap-2 rounded-md border border-gold/40 bg-surface-raised px-2 py-1 text-xs font-semibold tracking-wide whitespace-nowrap text-gold uppercase transition-colors hover:border-gold lg:inline-flex"
    >
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-gold" />
      </span>
      {label}
    </Link>
  );
}
