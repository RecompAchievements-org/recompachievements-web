import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PreviewNotice } from "@/components/game/PreviewNotice";
import { ProgressRow } from "@/components/progress/ProgressRow";
import { buildSampleProgress } from "@/components/progress/sampleProgress";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { Card } from "@/components/ui/Card";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { formatNumber, interpolate } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getPublicPlayer, type PlayerAvatar } from "@/lib/api/accounts";
import { getGames, type GameSummary } from "@/lib/api/games";
import { getClientIp } from "@/lib/clientIp";

type Props = PageProps<"/[lang]/progress/[username]">;

// Stays out of search results while the page shows sample data.
export async function generateMetadata(): Promise<Metadata> {
  const { progress } = await getMessages();
  return { title: progress.metaTitle, robots: { index: false, follow: false } };
}

export default async function ProgressPage({ params }: Props) {
  const { progress } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<ProgressSkeleton label={progress.loading} />}>
        <ProgressPanel params={params} />
      </Suspense>
    </div>
  );
}

async function ProgressPanel({ params }: Pick<Props, "params">) {
  const { username } = await params;
  const locale = await getLocale();
  const messages = await getMessages();
  const { progress } = messages;

  // Sent with the visitor's IP and never cached: a disabled player disappears at once.
  let player: string;
  let avatar: PlayerAvatar | null;
  let games: GameSummary[];
  try {
    const result = await getPublicPlayer(decodeURIComponent(username), { clientIp: await getClientIp() });
    if (!result.ok && result.status === 404) notFound();
    if (!result.ok) throw new Error(`Loading the player failed with status ${result.status}.`);
    player = result.data.username;
    avatar = result.data.avatar;
    games = await getGames(locale);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Completion progress unavailable", error);
    return <p className="text-muted">{progress.unavailable}</p>;
  }

  const rows = buildSampleProgress(games);
  const unlocked = rows.reduce((sum, row) => sum + row.unlocked, 0);
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length) : 0;

  return (
    <>
      <header className="flex items-center gap-4">
        <ProfilePhoto avatar={avatar} label={progress.photoAlt} className="size-16 rounded-lg sm:size-20" />
        <h1 className="min-w-0 font-display text-3xl font-bold tracking-tight wrap-anywhere sm:text-4xl">
          {interpolate(progress.title, { username: player })}
        </h1>
      </header>

      <PreviewNotice title={progress.sampleTitle} text={progress.sampleText} />

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat label={progress.averageCompletion}>{`${formatNumber(locale, average)}%`}</Stat>
        <Stat label={progress.achievementsUnlocked}>{formatNumber(locale, unlocked)}</Stat>
        <Stat label={progress.pointsEarned}>{formatNumber(locale, points)}</Stat>
      </dl>

      <section aria-labelledby="progress-games" className="flex flex-col gap-3">
        <h2 id="progress-games" className="font-display text-xl font-semibold">
          {progress.gamesHeading}
        </h2>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ProgressRow key={row.game.slug} row={row} locale={locale} messages={messages} />
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">
        {rich(messages.home.artSource, {
          source: (
            <ExternalLink href="https://www.steamgriddb.com/" className="text-foreground underline hover:text-accent">
              <span translate="no">SteamGridDB</span>
            </ExternalLink>
          ),
        })}
      </p>
    </>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="flex items-baseline justify-between gap-3 sm:flex-col sm:justify-start sm:gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-mono text-2xl font-semibold text-gold">{children}</dd>
    </Card>
  );
}

// Same layout as the loaded page, so nothing shifts when it arrives.
function ProgressSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-lg sm:size-20" />
        <SkeletonText widths={["w-64 max-w-full"]} className="min-w-0 flex-1 font-display text-3xl sm:text-4xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[4.75rem] rounded-xl sm:h-[6.25rem]" />
        ))}
      </div>
      <SkeletonText widths={["w-24"]} className="font-display text-xl" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[6.5rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
