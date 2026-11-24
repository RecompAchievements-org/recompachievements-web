import type { Metadata } from "next";
import { Suspense } from "react";
import { LogList, ModerationShell, ModerationSkeleton } from "@/components/moderation/ModerationShell";
import { ButtonLink } from "@/components/ui/Button";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getModerationLog } from "@/lib/api/moderation";
import { visitor } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/staff";

export async function generateMetadata(): Promise<Metadata> {
  const { moderation } = await getMessages();
  return { title: moderation.log, robots: { index: false, follow: false } };
}

export default async function ModerationLogPage({ searchParams }: PageProps<"/[lang]/moderation/log">) {
  const { moderation } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{moderation.log}</h1>
      <Suspense fallback={<ModerationSkeleton label={moderation.loading} />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Log({ searchParams }: Pick<PageProps<"/[lang]/moderation/log">, "searchParams">) {
  await requireStaff();
  const locale = await getLocale();
  const { moderation: copy } = await getMessages();
  const { before } = await searchParams;
  const result = await getModerationLog(typeof before === "string" ? before : null, await visitor());

  return (
    <ModerationShell locale={locale} copy={copy} active="log">
      {result.ok ? <LogList entries={result.data.actions} locale={locale} copy={copy} /> : <p className="text-muted">{copy.unavailable}</p>}
      {result.ok && result.data.nextCursor && (
        <ButtonLink href={`${localizePath(locale, "/moderation/log")}?before=${encodeURIComponent(result.data.nextCursor)}`} variant="secondary" className="self-center">
          {copy.older}
        </ButtonLink>
      )}
    </ModerationShell>
  );
}
