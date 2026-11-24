import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ModerationControls } from "@/components/moderation/ModerationControls";
import { formatModerationDate, ModerationShell, ModerationSkeleton, statusTone } from "@/components/moderation/ModerationShell";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getReport } from "@/lib/api/moderation";
import { visitor } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/staff";

type Props = PageProps<"/[lang]/moderation/reports/[id]">;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const { moderation } = await getMessages();
  return { title: moderation.reportTitle, robots: { index: false, follow: false } };
}

export default async function ModerationReportPage({ params }: Props) {
  const { moderation } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{moderation.reportTitle}</h1>
      <Suspense fallback={<ModerationSkeleton label={moderation.loading} />}>
        <ReportPanel params={params} />
      </Suspense>
    </div>
  );
}

async function ReportPanel({ params }: Pick<Props, "params">) {
  await connection();
  const staff = await requireStaff();
  const { id } = await params;
  if (!idPattern.test(id)) notFound();
  const locale = await getLocale();
  const { moderation: copy, auth } = await getMessages();
  const result = await getReport(id, await visitor());
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) return <p className="text-muted">{copy.unavailable}</p>;

  const { report, reportedUser: user, snapshot, targetKey, targetStillExists } = result.data;
  const isMuted = user?.isMuted ?? false;
  const canAct = !!user && user.username !== staff.username && (staff.role === "admin" || user.role === "player");
  const isComment = report.targetType === "comment";
  const location = result.data.commentLocation;
  const contextHref = location && localizePath(locale, location.kind === "wall" ? `/account/${location.key}` : `/games/${location.key}`);

  return (
    <ModerationShell locale={locale} copy={copy} active={null}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone[report.status]}>{copy.statuses[report.status]}</Badge>
            <Badge>{copy.targets[report.targetType]}</Badge>
            <span className="font-semibold">{copy.reasons[report.reason]}</span>
          </div>
          <p className="text-sm text-muted wrap-anywhere">
            {copy.reportedBy
              .replace("{target}", report.reportedUsername ?? copy.deletedAccount)
              .replace("{reporter}", report.reporterUsername ?? copy.deletedAccount)}{" "}
            · {formatModerationDate(locale, report.createdAt)}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {user && (
              <Link href={localizePath(locale, `/moderation/users/${user.username}`)} className="text-sm font-semibold text-accent underline hover:text-accent-strong">
                {copy.viewAccount}
              </Link>
            )}
            {contextHref && (
              <Link href={contextHref} className="text-sm font-semibold text-accent underline hover:text-accent-strong">
                {copy.viewInContext}
              </Link>
            )}
          </div>
          {report.details && (
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">{copy.reporterDetails}</h2>
              <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-muted">{report.details}</p>
            </div>
          )}
          {snapshot && (
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">{copy.reportedText}</h2>
              <p className="rounded-md bg-surface-raised p-3 text-sm leading-relaxed wrap-anywhere whitespace-pre-line">{snapshot}</p>
            </div>
          )}
          {report.targetType === "photo" && user?.avatar && targetStillExists && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{copy.reportedPhoto}</h2>
              <ProfilePhoto avatar={user.avatar} variant="large" label={copy.photoOf.replace("{username}", user.username)} className="size-40 rounded-lg" />
            </div>
          )}
          {!targetStillExists && <p className="text-sm text-gold">{copy.targetGone}</p>}
          {result.data.resolutionNote && (
            <div className="flex flex-col gap-1 border-t border-border pt-4">
              <h2 className="text-sm font-semibold">{copy.resolution}</h2>
              <p className="text-sm wrap-anywhere whitespace-pre-line text-muted">{result.data.resolutionNote}</p>
              <p className="text-xs text-subtle">
                {result.data.resolvedByUsername ?? copy.deletedAccount}
                {result.data.resolvedAt && ` · ${formatModerationDate(locale, result.data.resolvedAt)}`}
              </p>
            </div>
          )}
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="px-2 font-display text-xl font-semibold">{copy.actionsHeading}</h2>
          <ModerationControls
            target={{
              username: user?.username ?? null,
              role: user?.role ?? null,
              isEnabled: user?.isEnabled ?? false,
              isMuted,
              hasPhoto: !!user?.avatar,
              reportId: report.id,
              reportOpen: report.status === "open",
              commentId: isComment && targetStillExists ? targetKey : undefined,
            }}
            canAct={canAct}
            isAdmin={staff.role === "admin"}
            labels={copy.actions}
            errors={auth.errors}
          />
        </Card>
      </div>
    </ModerationShell>
  );
}
