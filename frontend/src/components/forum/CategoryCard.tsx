import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { SkeletonText } from "@/components/ui/Skeleton";
import { localizePath, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { ForumCategory, ForumPostSummary } from "@/lib/api/forum";
import { forumDate } from "./ForumParts";

/** A forum category with its pinned and five most recent posts, shared by the forum home and the
 *  home page's news column. Rows react to the card's own width (container queries), so the same
 *  card fits a full-width list and a narrow sidebar.
**/
export function CategoryCard({ locale, category, copy }: { locale: Locale; category: ForumCategory; copy: Messages["forum"] }) {
  return (
    <Card className="@container flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">
            {/** The arrow and its nudge on hover show that the title opens the category. **/}
            <Link
              href={localizePath(locale, `/forum/${category.key}`)}
              className="group inline-flex min-h-11 items-center gap-2 rounded-md text-accent transition-colors hover:text-accent-strong"
            >
              {categoryIcons[category.key] && (
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-6 shrink-0">
                  {categoryIcons[category.key]}
                </svg>
              )}
              {category.name}
              <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 transition-transform group-hover:translate-x-1">
                <path d="M4 10h11M11 5l5 5-5 5" />
              </svg>
            </Link>
          </h2>
          <span className="text-sm text-subtle">{plural(locale, category.postCount, copy.postCount)}</span>
        </div>
        <p className="leading-relaxed text-muted">{category.description}</p>
      </div>
      <PostSection title={copy.pinned} icon="pin" posts={category.pinnedPosts} empty={copy.noPinned} locale={locale} category={category.key} />
      <PostSection title={copy.recent} icon="clock" posts={category.recentPosts} empty={copy.noPosts} locale={locale} category={category.key} />
    </Card>
  );
}

// An icon per category key, shown before its title; categories without one show the title alone.
const categoryIcons: Record<string, ReactNode> = {
  news: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h10A1.5 1.5 0 0 1 17 5.5V18a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
      <path d="M17 9h2.5A1.5 1.5 0 0 1 21 10.5V18a2 2 0 0 1-2 2" />
      <path d="M7.5 8h6M7.5 12h6M7.5 16h3.5" />
    </>
  ),
};

const sectionIcons = {
  pin: <path d="M7.5 2.5h5M8.5 2.5v5L5.5 11h9l-3-3.5v-5M10 11v6.5" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </>
  ),
};

const rowClasses = "flex flex-col gap-0.5 py-2.5 first:pt-1 last:pb-0 @md:flex-row @md:items-baseline @md:justify-between @md:gap-4";

// One titled list of posts (pinned or recent) inside a category card, newest first.
function PostSection({
  title,
  icon,
  posts,
  empty,
  locale,
  category,
}: {
  title: string;
  icon: keyof typeof sectionIcons;
  posts: ForumPostSummary[];
  empty: string;
  locale: Locale;
  category: string;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-subtle uppercase">
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
          {sectionIcons[icon]}
        </svg>
        {title}
      </h3>
      {posts.length === 0 ? (
        <p className="text-sm text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {posts.map((post) => (
            <li key={post.slug} className={rowClasses}>
              <Link href={localizePath(locale, `/forum/${category}/${post.slug}`)} className="min-w-0 font-semibold wrap-anywhere text-foreground hover:text-accent">
                {post.title}
              </Link>
              {post.publishedAt && <span className="shrink-0 text-sm text-subtle">{forumDate(locale, post.publishedAt)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Same card as a loaded category: heading, description, one pinned post, and five recent posts.
export function CategoryCardSkeleton({ label }: { label: string }) {
  const section = (rows: number, key: string) => (
    <div key={key} className="flex flex-col gap-2 border-t border-border pt-4">
      <SkeletonText widths={["w-24"]} className="text-xs" />
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={rowClasses}>
            <SkeletonText widths={[index % 2 ? "w-1/2" : "w-2/3"]} />
            <SkeletonText widths={["w-28"]} className="text-sm" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div role="status" aria-label={label}>
      <Card className="@container flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex min-h-11 items-center justify-between gap-2">
            <SkeletonText widths={["w-32"]} className="font-display text-2xl" />
            <SkeletonText widths={["w-16"]} className="text-sm" />
          </div>
          <SkeletonText widths={["w-full", "w-1/2"]} className="leading-relaxed" />
        </div>
        {section(1, "pinned")}
        {section(5, "recent")}
      </Card>
    </div>
  );
}
