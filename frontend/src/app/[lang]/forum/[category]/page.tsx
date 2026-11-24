import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CommentPagination, commentPageFrom } from "@/components/comments/CommentPagination";
import { ForumHeaderSkeleton, PostCard, PostListSkeleton } from "@/components/forum/ForumParts";
import { ButtonLink } from "@/components/ui/Button";
import { localeAlternates, localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getAdminForumPosts, getForumPosts, type ForumPostPage } from "@/lib/api/forum";
import { getCurrentAccount, visitor } from "@/lib/auth/session";

type Props = PageProps<"/[lang]/forum/[category]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const locale = await getLocale();
  const { forum } = await getMessages();
  try {
    const page = await getForumPosts(category, 1, locale);
    if (!page) return { title: forum.metaTitle, robots: { index: false } };
    return { title: page.category.name, description: page.category.description, alternates: localeAlternates(locale, `/forum/${category}`) };
  } catch {
    return { title: forum.metaTitle };
  }
}

export default async function ForumCategoryPage({ params, searchParams }: Props) {
  const { forum } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-20">
      <Suspense
        fallback={
          <div role="status" aria-label={forum.loading} className="flex flex-col gap-8">
            <ForumHeaderSkeleton />
            <PostListSkeleton count={5} />
          </div>
        }
      >
        <CategoryPanel params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryPanel({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await connection();
  const { category } = await params;
  const requested = commentPageFrom((await searchParams).page);
  const locale = await getLocale();
  const { forum } = await getMessages();
  const base = localizePath(locale, `/forum/${category}`);

  let page: ForumPostPage | null;
  try {
    page = await getForumPosts(category, requested, locale);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Forum category unavailable", error);
    return <p className="text-muted">{forum.unavailable}</p>;
  }

  if (!page) notFound();
  if (page.totalPages > 0 && requested > page.totalPages) redirect(`${base}?page=${page.totalPages}`);

  const account = await getCurrentAccount();
  const isAdmin = account?.role === "admin";
  let drafts: ForumPostPage["posts"] = [];
  if (isAdmin) {
    const all = await getAdminForumPosts(category, 1, locale, await visitor());
    if (all.ok) drafts = all.data.posts.filter((post) => post.status === "draft");
  }

  return (
    <>
      <header className="flex flex-col gap-4">
        <Link href={localizePath(locale, "/forum")} className="self-start text-sm text-muted hover:text-foreground">
          <span aria-hidden="true">← </span>
          {forum.backToForum}
        </Link>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight wrap-anywhere sm:text-5xl">{page.category.name}</h1>
        <p className="text-lg leading-relaxed text-muted">{page.category.description}</p>
        {isAdmin && (
          <ButtonLink href={`${base}/new`} className="self-start">
            {forum.newPost}
          </ButtonLink>
        )}
      </header>

      {drafts.length > 0 && (
        <section aria-labelledby="forum-drafts" className="flex flex-col gap-4">
          <h2 id="forum-drafts" className="font-display text-xl font-semibold">
            {forum.drafts}
          </h2>
          {drafts.map((post) => (
            <PostCard key={post.slug} locale={locale} category={category} post={post} copy={forum} showStatus />
          ))}
        </section>
      )}

      {page.posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">{forum.noPosts}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {page.posts.map((post) => (
            <PostCard key={post.slug} locale={locale} category={category} post={post} copy={forum} />
          ))}
        </div>
      )}

      <CommentPagination
        page={page.page}
        totalPages={page.totalPages}
        href={(number) => (number > 1 ? `${base}?page=${number}` : base)}
        labels={forum.pagination}
      />
    </>
  );
}
