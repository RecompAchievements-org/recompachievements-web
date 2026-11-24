import Link from "next/link";
import { cx } from "@/lib/cx";

export interface CommentPaginationLabels {
  label: string;
  previous: string;
  next: string;
  pageOf: string;
  goToPage: string;
}

// The first and last pages, the current one, and its neighbours; null marks a gap ("…").
function visiblePages(current: number, total: number): (number | null)[] {
  const wanted = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
  const pages = [...wanted].sort((a, b) => a - b);
  return pages.flatMap((page, index) => (index > 0 && page - pages[index - 1] > 1 ? [null, page] : [page]));
}

/** Numbered pages for a comment section. Phones get Previous, "Page 3 of 12", and Next; wider
 *  screens also list nearby page numbers. Links keep the reader at the comments (#comments).
**/
export function CommentPagination({
  page,
  totalPages,
  href,
  labels,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
  labels: CommentPaginationLabels;
}) {
  if (totalPages <= 1) return null;

  const step = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors";
  const idle = "border-border-strong bg-surface-raised text-foreground hover:border-accent";
  const disabled = "pointer-events-none border-border text-subtle opacity-60";
  const pageOf = labels.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages));

  return (
    <nav aria-label={labels.label} className="flex items-center justify-between gap-2 sm:justify-center">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={cx(step, idle)}>
          {labels.previous}
        </Link>
      ) : (
        <span aria-disabled="true" className={cx(step, disabled)}>
          {labels.previous}
        </span>
      )}

      <span className="text-sm text-muted sm:hidden">{pageOf}</span>
      <ol className="hidden items-center gap-1 sm:flex">
        {visiblePages(page, totalPages).map((item, index) =>
          item === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={href(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={labels.goToPage.replace("{page}", String(item))}
                className={cx(step, item === page ? "border-accent bg-accent text-on-accent" : idle)}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={cx(step, idle)}>
          {labels.next}
        </Link>
      ) : (
        <span aria-disabled="true" className={cx(step, disabled)}>
          {labels.next}
        </span>
      )}
    </nav>
  );
}

// Reads the comment page from the URL: a positive whole number, otherwise page 1.
export function commentPageFrom(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export const commentPageHref = (basePath: string, page: number, anchor = "comments") =>
  `${basePath}${page > 1 ? `?commentsPage=${page}` : ""}#${anchor}`;
