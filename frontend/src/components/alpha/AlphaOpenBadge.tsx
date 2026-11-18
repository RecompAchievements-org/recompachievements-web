import Link from "next/link";
import { cx } from "@/lib/cx";

/** Gold "alpha sign-up open" announcement with a pulsing dot. Rendered as a link when given an
 *  href (home page), or as a plain label (on the sign-up page itself). The pulse stops for
 *  visitors who prefer reduced motion (global rule in globals.css).
**/
export function AlphaOpenBadge({ label, href }: { label: string; href?: string }) {
  const content = (
    <>
      <span aria-hidden="true" className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-gold" />
      </span>
      {label}
    </>
  );
  const classes =
    "inline-flex items-center gap-2 self-start rounded-full border border-gold/40 bg-surface-raised px-3 py-1 text-xs font-semibold tracking-wide text-gold uppercase";

  return href ? (
    <Link href={href} className={cx(classes, "transition-colors hover:border-gold")}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
