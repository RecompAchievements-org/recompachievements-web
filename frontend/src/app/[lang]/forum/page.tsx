import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { forumDate } from "@/components/forum/ForumParts";
import { Card } from "@/components/ui/Card";
import { SkeletonText } from "@/components/ui/Skeleton";
import { localeAlternates, localizePath, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumCategories, type ForumCategory, type ForumPostSummary } from "@/lib/api/forum";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { forum } = await getMessages();
  return { title: forum.metaTitle, description: forum.metaDescription, alternates: localeAlternates(locale, "/forum") };
}

export default async function ForumPage() {
  const { forum } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{forum.title}</h1>
        <p className="text-lg leading-relaxed text-muted">{forum.intro}</p>
      </header>
      <Suspense fallback={<CategoriesSkeleton label={forum.loading} />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await connection();
  const locale = await getLocale();
  const { forum } = await getMessages();

  let categories: ForumCategory[];
  try {
    categories = await getForumCategories(locale);
  } catch (error) {
    console.error("Forum unavailable", error);
    return <p className="text-muted">{forum.unavailable}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {categories.map((category) => (
        <li key={category.key}>
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold">
                  {/** The arrow and its nudge on hover show that the title opens the category. **/}
                  <Link
                    href={localizePath(locale, `/forum/${category.key}`)}
                    className="group inline-flex min-h-11 items-center gap-2 rounded-md text-accent transition-colors hover:text-accent-strong"
                  >
                    {category.name}
                    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0 transition-transform group-hover:translate-x-1">
                      <path d="M4 10h11M11 5l5 5-5 5" />
                    </svg>
                  </Link>
                </h2>
                <span className="text-sm text-subtle">{plural(locale, category.postCount, forum.postCount)}</span>
              </div>
              <p className="leading-relaxed text-muted">{category.description}</p>
            </div>
            <PostSection
              title={forum.pinned}
              icon="pin"
              posts={category.pinnedPosts}
              empty={forum.noPinned}
              locale={locale}
              category={category.key}
            />
            <PostSection title={forum.recent} icon="clock" posts={category.recentPosts} empty={forum.noPosts} locale={locale} category={category.key} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

const sectionIcons = {
  pin: <path d="M7.5 2.5h5M8.5 2.5v5L5.5 11h9l-3-3.5v-5M10 11v6.5" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </>
  ),
};

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
            <li key={post.slug} className="flex flex-col gap-0.5 py-2.5 first:pt-1 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
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
function CategoriesSkeleton({ label }: { label: string }) {
  const section = (rows: number, key: string) => (
    <div key={key} className="flex flex-col gap-2 border-t border-border pt-4">
      <SkeletonText widths={["w-24"]} className="text-xs" />
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex flex-col gap-0.5 py-2.5 first:pt-1 last:pb-0 sm:flex-row sm:justify-between sm:gap-4">
            <SkeletonText widths={[index % 2 ? "w-1/2" : "w-2/3"]} />
            <SkeletonText widths={["w-28"]} className="text-sm" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div role="status" aria-label={label}>
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
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
