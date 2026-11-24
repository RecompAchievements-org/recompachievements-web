import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ModerationControls } from "@/components/moderation/ModerationControls";
import { formatModerationDate, LogList, ModerationShell, ModerationSkeleton } from "@/components/moderation/ModerationShell";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getModerationUser } from "@/lib/api/moderation";
import { visitor } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/staff";

type Props = PageProps<"/[lang]/moderation/users/[username]">;

export async function generateMetadata(): Promise<Metadata> {
  const { moderation } = await getMessages();
  return { title: moderation.metaTitle, robots: { index: false, follow: false } };
}

export default async function ModerationUserPage({ params }: Props) {
  const { moderation } = await getMessages();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{moderation.userTitle}</h1>
      <Suspense fallback={<ModerationSkeleton label={moderation.loading} />}>
        <UserPanel params={params} />
      </Suspense>
    </div>
  );
}

async function UserPanel({ params }: Pick<Props, "params">) {
  await connection();
  const staff = await requireStaff();
  const { username } = await params;
  const locale = await getLocale();
  const { moderation: copy, auth } = await getMessages();
  const result = await getModerationUser(decodeURIComponent(username), await visitor());
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) return <p className="text-muted">{copy.unavailable}</p>;

  const user = result.data;
  const { isMuted } = user;
  const canAct = user.username !== staff.username && (staff.role === "admin" || user.role === "player");

  return (
    <ModerationShell locale={locale} copy={copy} active={null}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row">
            <ProfilePhoto avatar={user.avatar} variant="large" label={copy.photoOf.replace("{username}", user.username)} className="size-28 self-center rounded-lg sm:self-start" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={localizePath(locale, `/account/${user.username}`)} className="font-display text-xl font-semibold wrap-anywhere hover:text-accent">
                  {user.username}
                </Link>
                <Badge tone={user.role === "player" ? "neutral" : "accent"}>{copy.actions.roles[user.role]}</Badge>
                {!user.isEnabled && <Badge tone="gold">{copy.disabled}</Badge>}
                {isMuted && <Badge tone="gold">{copy.muted}</Badge>}
              </div>
              <dl className="grid gap-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
                <dt className="text-muted">{copy.joined}</dt>
                <dd>{formatModerationDate(locale, user.createdAt)}</dd>
                <dt className="text-muted">{copy.lastActive}</dt>
                <dd>{formatModerationDate(locale, user.lastActivityAt)}</dd>
                <dt className="text-muted">{copy.openReports}</dt>
                <dd>{user.openReports}</dd>
                {isMuted && (
                  <>
                    <dt className="text-muted">{copy.mutedUntil}</dt>
                    <dd>{formatModerationDate(locale, user.mutedUntil!)}</dd>
                  </>
                )}
              </dl>
            </div>
          </Card>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold">{copy.history}</h2>
            <LogList entries={user.recentActions} locale={locale} copy={copy} />
          </section>
        </div>
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="px-2 font-display text-xl font-semibold">{copy.actionsHeading}</h2>
          <ModerationControls
            target={{ username: user.username, role: user.role, isEnabled: user.isEnabled, isMuted, hasPhoto: !!user.avatar }}
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
