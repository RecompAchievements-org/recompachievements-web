import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PostEditor } from "@/components/forum/PostEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumPostSource } from "@/lib/api/forum";
import { visitor } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/staff";

type Props = PageProps<"/[lang]/forum/[category]/[slug]/edit">;

export async function generateMetadata(): Promise<Metadata> {
  const { forum } = await getMessages();
  return { title: forum.editor.editTitle, robots: { index: false, follow: false } };
}

export default async function EditForumPostPage({ params }: Props) {
  const { forum } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{forum.editor.editTitle}</h1>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
        <EditPanel params={params} />
      </Suspense>
    </div>
  );
}

async function EditPanel({ params }: Pick<Props, "params">) {
  await connection();
  await requireAdmin();
  const { category, slug } = await params;
  const locale = await getLocale();
  const { forum, common } = await getMessages();
  const result = await getForumPostSource(category, slug, await visitor());
  if (!result.ok) notFound();

  return <PostEditor category={category} locale={locale} source={result.data} messages={forum.editor} newTabLabel={common.opensInNewTab} />;
}
