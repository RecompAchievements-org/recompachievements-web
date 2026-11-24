import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { ModerationLogEntry, ReportStatus } from "@/lib/api/moderation";
import { cx } from "@/lib/cx";
import { UserSearch } from "./UserSearch";

export const formatModerationDate = (locale: Locale, value: string) =>
  `${formatDate(locale, new Date(value), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

export const statusTone: Record<ReportStatus, BadgeTone> = { open: "gold", resolved: "success", dismissed: "neutral" };

export function ModerationShell({
  locale,
  copy,
  active,
  children,
}: {
  locale: Locale;
  copy: Messages["moderation"];
  active: "queue" | "log" | null;
  children: ReactNode;
}) {
  const tab = (current: boolean) =>
    cx("inline-flex min-h-11 items-center rounded-md px-4 font-semibold transition-colors", current ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label={copy.nav} className="flex gap-1">
          <Link href={localizePath(locale, "/moderation")} aria-current={active === "queue" ? "page" : undefined} className={tab(active === "queue")}>
            {copy.queue}
          </Link>
          <Link href={localizePath(locale, "/moderation/log")} aria-current={active === "log" ? "page" : undefined} className={tab(active === "log")}>
            {copy.log}
          </Link>
        </nav>
        <UserSearch locale={locale} label={copy.findUser} button={copy.find} />
      </div>
      {children}
    </div>
  );
}

export function LogList({ entries, locale, copy }: { entries: ModerationLogEntry[]; locale: Locale; copy: Messages["moderation"] }) {
  if (entries.length === 0) return <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">{copy.noActions}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={entry.action === "legal_hold" || entry.action === "disable" ? "gold" : "neutral"}>
                {copy.logActions[entry.action as keyof typeof copy.logActions] ?? entry.action}
              </Badge>
              <span className="text-sm text-subtle">{formatModerationDate(locale, entry.createdAt)}</span>
            </div>
            <p className="text-sm text-muted wrap-anywhere">
              <span className="font-semibold text-foreground">{entry.moderatorUsername ?? copy.deletedAccount}</span>
              {" → "}
              {entry.targetUsername ? (
                <Link href={localizePath(locale, `/moderation/users/${entry.targetUsername}`)} className="text-accent underline hover:text-accent-strong">
                  {entry.targetUsername}
                </Link>
              ) : (
                copy.deletedAccount
              )}
            </p>
            <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-line">{entry.reason}</p>
            {entry.evidence && <p className="rounded-md bg-surface-raised p-2 text-sm text-muted wrap-anywhere whitespace-pre-line">{entry.evidence}</p>}
            {entry.expiresAt && <p className="text-xs text-subtle">{copy.until.replace("{date}", formatModerationDate(locale, entry.expiresAt))}</p>}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ModerationSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <Skeleton className="h-11 w-48 rounded-md" />
        <Skeleton className="h-11 w-full rounded-lg lg:w-80" />
      </div>
      {[0, 1, 2].map((index) => (
        <Card key={index} className="flex flex-col gap-3 p-4">
          <SkeletonText widths={["w-40"]} className="text-sm" />
          <SkeletonText widths={["w-full", "w-2/3"]} className="text-sm" />
        </Card>
      ))}
    </div>
  );
}
