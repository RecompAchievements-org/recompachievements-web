import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PostEditor } from "@/components/forum/PostEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumPosts } from "@/lib/api/forum";
import { requireAdmin } from "@/lib/auth/staff";

type Props = PageProps<"/[lang]/forum/[category]/new">;

export async function generateMetadata(): Promise<Metadata> {
  const { forum } = await getMessages();
  return { title: forum.editor.newTitle, robots: { index: false, follow: false } };
}

export default async function NewForumPostPage({ params }: Props) {
  const { forum } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{forum.editor.newTitle}</h1>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <NewPanel params={params} />
      </Suspense>
    </div>
  );
}

async function NewPanel({ params }: Pick<Props, "params">) {
  await connection();
  await requireAdmin();
  const { category } = await params;
  const locale = await getLocale();
  const { forum, common } = await getMessages();
  if (!(await getForumPosts(category, 1, locale))) notFound();

  return <PostEditor category={category} locale={locale} source={null} messages={forum.editor} newTabLabel={common.opensInNewTab} />;
}
