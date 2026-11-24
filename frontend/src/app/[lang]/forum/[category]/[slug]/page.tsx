import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ForumAuthor, forumDate } from "@/components/forum/ForumParts";
import { Markdown } from "@/components/forum/Markdown";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { htmlLang, localeAlternates, localizePath } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumPost, type ForumPost } from "@/lib/api/forum";
import { getCurrentAccount } from "@/lib/auth/session";

type Props = PageProps<"/[lang]/forum/[category]/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const locale = await getLocale();
  const { forum } = await getMessages();
  try {
    const post = await getForumPost(category, slug, locale);
    if (!post) return { title: forum.metaTitle, robots: { index: false } };
    return {
      title: post.title,
      description: post.excerpt,
      alternates: localeAlternates(locale, `/forum/${category}/${slug}`),
      openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt ?? undefined },
    };
  } catch {
    return { title: forum.metaTitle };
  }
}

export default async function ForumPostPage({ params }: Props) {
  const { forum } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <Suspense fallback={<PostSkeleton label={forum.loading} />}>
        <PostPanel params={params} />
      </Suspense>
    </div>
  );
}

async function PostPanel({ params }: Pick<Props, "params">) {
  await connection();
  const { category, slug } = await params;
  const locale = await getLocale();
  const { forum, common } = await getMessages();

  let post: ForumPost | null;
  try {
    post = await getForumPost(category, slug, locale);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Forum post unavailable", error);
    return <p className="text-muted">{forum.unavailable}</p>;
  }
  if (!post) notFound();

  const account = await getCurrentAccount();
  const shownInEnglish = !post.languages.includes(locale);

  return (
    <article lang={shownInEnglish ? "en" : htmlLang[locale]} className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link href={localizePath(locale, `/forum/${category}`)} className="self-start text-sm text-muted hover:text-foreground">
          <span aria-hidden="true">← </span>
          {interpolate(forum.backToCategory, { category: post.categoryName })}
        </Link>
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-balance wrap-break-word sm:text-5xl">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-4 text-sm text-subtle">
          <ForumAuthor locale={locale} username={post.authorUsername} avatar={post.authorAvatar} team={forum.team} />
          {post.publishedAt && (
            <>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <time dateTime={post.publishedAt}>{forumDate(locale, post.publishedAt)}</time>
            </>
          )}
          {post.editedAt && (
            <>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span>{interpolate(forum.editedOn, { date: forumDate(locale, post.editedAt) })}</span>
            </>
          )}
          {account?.role === "admin" && (
            <ButtonLink href={localizePath(locale, `/forum/${category}/${slug}/edit`)} variant="secondary" size="sm" className="sm:ml-auto">
              {forum.edit}
            </ButtonLink>
          )}
        </div>
        {shownInEnglish && (
          <p lang={htmlLang[locale]} className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
            {forum.englishOnly}
          </p>
        )}
      </header>
      <Markdown source={post.body} locale={locale} newTabLabel={common.opensInNewTab} />
    </article>
  );
}

function PostSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <SkeletonText widths={["w-full", "w-1/2"]} className="font-display text-3xl leading-tight sm:text-5xl" />
        <SkeletonText widths={["w-56"]} className="border-b border-border pb-4 text-sm" />
      </div>
      <SkeletonText widths={["w-full", "w-full", "w-3/4", "w-full", "w-2/3"]} className="leading-relaxed" />
    </div>
  );
}
