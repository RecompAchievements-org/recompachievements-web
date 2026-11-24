import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatModerationDate, ModerationShell, ModerationSkeleton, statusTone } from "@/components/moderation/ModerationShell";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getReports, type ReportStatus } from "@/lib/api/moderation";
import { visitor } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/staff";
import { cx } from "@/lib/cx";

const statuses: ReportStatus[] = ["open", "resolved", "dismissed"];

export async function generateMetadata(): Promise<Metadata> {
  const { moderation } = await getMessages();
  return { title: moderation.metaTitle, robots: { index: false, follow: false } };
}

export default async function ModerationPage({ searchParams }: PageProps<"/[lang]/moderation">) {
  const { moderation } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{moderation.title}</h1>
      <Suspense fallback={<ModerationSkeleton label={moderation.loading} />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/[lang]/moderation">, "searchParams">) {
  await requireStaff();
  const locale = await getLocale();
  const { moderation: copy } = await getMessages();
  const { status: rawStatus, before: rawBefore } = await searchParams;
  const status = statuses.find((value) => value === rawStatus) ?? "open";
  const before = typeof rawBefore === "string" ? rawBefore : null;
  const result = await getReports(status, before, await visitor());
  const href = (next: ReportStatus, cursor?: string) =>
    `${localizePath(locale, "/moderation")}?status=${next}${cursor ? `&before=${encodeURIComponent(cursor)}` : ""}`;

  return (
    <ModerationShell locale={locale} copy={copy} active="queue">
      <nav aria-label={copy.statusNav} className="flex flex-wrap gap-2">
        {statuses.map((value) => (
          <Link
            key={value}
            href={href(value)}
            aria-current={value === status ? "true" : undefined}
            className={cx("inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold transition-colors", value === status ? "border-accent text-foreground" : "border-border text-muted hover:border-border-strong")}
          >
            {copy.statuses[value]}
          </Link>
        ))}
      </nav>
      {!result.ok ? (
        <p className="text-muted">{copy.unavailable}</p>
      ) : result.data.reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">{copy.noReports}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.reports.map((report) => (
            <li key={report.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone[report.status]}>{copy.statuses[report.status]}</Badge>
                    <Badge>{copy.targets[report.targetType]}</Badge>
                    <span className="text-sm font-semibold">{copy.reasons[report.reason]}</span>
                  </div>
                  <p className="text-sm text-muted wrap-anywhere">
                    {copy.reportedBy
                      .replace("{target}", report.reportedUsername ?? copy.deletedAccount)
                      .replace("{reporter}", report.reporterUsername ?? copy.deletedAccount)}
                  </p>
                  <p className="text-xs text-subtle">{formatModerationDate(locale, report.createdAt)}</p>
                </div>
                <ButtonLink href={localizePath(locale, `/moderation/reports/${report.id}`)} variant="secondary" className="shrink-0">
                  {copy.review}
                </ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {result.ok && result.data.nextCursor && (
        <ButtonLink href={href(status, result.data.nextCursor)} variant="secondary" className="self-center">
          {copy.older}
        </ButtonLink>
      )}
    </ModerationShell>
  );
}
