import Link from "next/link";
import type { ReactNode } from "react";
import { achievementIconClasses } from "@/components/game/AchievementRow";
import { GameArt } from "@/components/game/GameArt";
import { consoleName } from "@/components/game/names";
import { PreviewNotice } from "@/components/game/PreviewNotice";
import { ProgressBar, progressLine, ProgressRow } from "@/components/progress/ProgressRow";
import {
  buildSampleProgress,
  sampleAchievements,
  sampleMedals,
  sampleSubsets,
  type SampleGameProgress,
  type MedalTier,
} from "@/components/progress/sampleProgress";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { formatNumber, plural } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getGame, getGames, type Achievement, type GameSummary } from "@/lib/api/games";

/** Medals, subsets, recent achievements, completion, and last game played on the public profile. They show labeled sample
 *  data built from real catalog games until real unlocks exist; replace them then.
**/
export async function ProfileSampleSections({ username }: { username: string }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { profile, rarity, achievement, home } = messages;

  let games: GameSummary[];
  let rows: SampleGameProgress[];
  let recent: Achievement[];
  try {
    games = await getGames(locale);
    rows = buildSampleProgress(games);
    const finished = rows[0] ? await getGame(rows[0].game.slug, locale) : null;
    recent = sampleAchievements(finished?.coreSet.achievements ?? []);
  } catch (error) {
    console.error("Profile sample sections unavailable", error);
    return <p className="text-muted">{profile.sectionsUnavailable}</p>;
  }

  const earned = rows.reduce((sum, row) => sum + row.unlocked, 0);
  const medals = sampleMedals(games, rows);
  const medalsEarned = medals.reduce((sum, medal) => sum + medal.total, 0);
  const subsets = sampleSubsets(rows);
  const subsetCounts = {
    mastered: subsets.filter((subset) => subset.status === "mastered").length,
    beaten: subsets.filter((subset) => subset.status === "beaten").length,
  };
  const lastGame = rows[1] ?? rows[0];

  return (
    <>
      <PreviewNotice title={messages.progress.sampleTitle} text={profile.sampleText} />

      <ProfileSection title={profile.medalsHeading} aside={<Badge tone="gold">{plural(locale, medalsEarned, profile.medalsCount)}</Badge>}>
        {/** Platinum is the large square; Gold and Silver are two rows beside it (below it on phones). **/}
        <ul className={medalGridClasses}>
          {medals.map(({ tier, featured, total }) => {
            const isPlatinum = tier === "platinum";
            const hasMedal = featured.length > 0;
            const tierColor = hasMedal ? medalClasses[tier] : "text-muted";
                        return (
              <li key={tier} className={`flex min-w-0 flex-col rounded-xl border border-border bg-surface px-3 pt-3 ${isPlatinum ? "sm:row-span-2" : ""}`}>
                <div className="flex items-center gap-3 pb-3">
                  <MedalIcon className={`size-10 shrink-0 ${medalClasses[tier]} ${hasMedal ? "" : "opacity-35"}`} />
                  <h3 className={`min-w-0 flex-1 font-display font-semibold text-lg ${tierColor}`}>
                    {profile.medalTiers[tier]}
                  </h3>
                  <p className="flex shrink-0 flex-col items-end">
                    <span className={`font-mono text-2xl leading-6 font-semibold ${hasMedal ? medalClasses[tier] : "text-subtle"}`}>
                      {formatNumber(locale, total)}
                    </span>
                    <span className="text-xs leading-4 text-subtle">{profile.medalTotal}</span>
                  </p>
                </div>
                {/** Platinum lists its games from the top with even gaps; Gold and Silver center their one game. **/}
                <div className={`flex min-h-15 flex-1 flex-col border-t border-border ${isPlatinum ? "gap-2.5 py-3" : "justify-center py-2"}`}>
                  {hasMedal ? (
                    featured.map((game) => (
                      <MedalGame key={game.slug} game={game} href={localizePath(locale, `/games/${game.slug}`)} large={isPlatinum} />
                    ))
                  ) : (
                    <p className="text-sm text-subtle">{profile.noMedal}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </ProfileSection>

      <ProfileSection title={profile.achievementsHeading} aside={<Badge tone="gold">{plural(locale, earned, profile.achievementsCount)}</Badge>}>
        {recent.length === 0 ? (
          <EmptyLegend text={profile.noAchievements} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.map((item) => (
              <li key={item.apiKeyName} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <div
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded-lg border bg-surface-raised font-display text-lg ${achievementIconClasses[item.rarityTier]}`}
                >
                  ★
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-sm font-semibold wrap-anywhere">{item.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={item.rarityTier}>{rarity[item.rarityTier]}</Badge>
                    <Badge tone="gold">{plural(locale, item.points, achievement.points)}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title={profile.subsetsHeading}>
        <dl className="grid grid-cols-2 gap-3">
          {(["mastered", "beaten"] as const).map((status) => (
            <div key={status} className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-baseline sm:justify-between sm:p-4">
              <dt className="text-sm text-muted">{profile.subsetCounters[status]}</dt>
              <dd className={`font-mono text-2xl leading-none font-semibold ${subsetStatusClasses[status]}`}>
                {formatNumber(locale, subsetCounts[status])}
              </dd>
            </div>
          ))}
        </dl>
        {subsets.length === 0 ? (
          <EmptyLegend text={profile.noSubsets} />
        ) : (
          <ul className="flex flex-col gap-2">
            {subsets.map(({ game, type, status }) => (
              <li key={`${game.slug}-${type}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <GameArt image={game.art?.icon ?? game.art?.cover} game={game} variant="thumb" sizes="44px" className="size-11 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={localizePath(locale, `/games/${game.slug}`)} className="text-sm font-semibold wrap-anywhere hover:text-accent">
                    {game.title}
                  </Link>
                  <span className="text-sm text-muted">{profile.subsetTypes[type]}</span>
                </div>
                <Badge tone={status === "mastered" ? "success" : "accent"} className="shrink-0">
                  {profile.subsetStatus[status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection
        title={profile.completionHeading}
        aside={
          <Link href={localizePath(locale, `/progress/${username}`)} className="text-sm font-semibold text-accent underline hover:text-accent-strong">
            {profile.viewAll}
          </Link>
        }
      >
        <ul className="flex flex-col gap-3">
          {rows.slice(0, 3).map((row) => (
            <ProgressRow key={row.game.slug} row={row} locale={locale} messages={messages} />
          ))}
        </ul>
      </ProfileSection>

      {lastGame && (
        <ProfileSection title={profile.lastGameHeading}>
          <Card className="grid gap-4 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
            <GameArt image={lastGame.game.art?.hero} game={lastGame.game} variant="card" sizes="(min-width: 640px) 224px, 100vw" />
            <div className="flex min-w-0 flex-col gap-3">
              <h3 className="font-display text-xl font-semibold wrap-anywhere">{lastGame.game.title}</h3>
              <ProgressBar label={lastGame.game.title} percent={lastGame.percent} />
              <p className="text-sm text-muted">{progressLine(lastGame, locale, messages)}</p>
              <ButtonLink href={localizePath(locale, `/games/${lastGame.game.slug}`)} variant="secondary" size="sm" className="min-h-11 sm:min-h-8 sm:self-start">
                {profile.viewGame}
              </ButtonLink>
            </div>
          </Card>
        </ProfileSection>
      )}

      <p className="text-sm text-muted">
        {rich(home.artSource, {
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

const subsetStatusClasses = { mastered: "text-success", beaten: "text-accent" } as const;

// A game a medal features: its square icon, name, and original platform.
function MedalGame({ game, href, large }: { game: GameSummary; href: string; large: boolean }) {
  return (
    <Link href={href} className="flex w-full min-w-0 items-center gap-2.5 rounded-md transition-colors hover:text-accent">
      <GameArt image={game.art?.icon ?? game.art?.cover} game={game} variant="thumb" sizes="40px" className="size-10 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span translate="no" title={game.title} className={`text-sm leading-tight font-semibold ${large ? "line-clamp-2 wrap-anywhere" : "truncate"}`}>
          {game.title}
        </span>
        <span className="truncate text-xs text-muted">{consoleName(game.originalPlatform)}</span>
      </span>
    </Link>
  );
}

const medalGridClasses = "grid gap-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:grid-rows-2";

const medalClasses: Record<MedalTier, string> = {
  platinum: "text-medal-platinum",
  gold: "text-medal-gold",
  silver: "text-medal-silver",
};

// The site's own medal (hexagon and star), so medals never resemble a platform's official icons.
function MedalIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="m24 13 3.2 7.2 7.8.8-5.9 5.2 1.7 7.7-6.8-4-6.8 4 1.7-7.7L13 21l7.8-.8z" fill="currentColor" />
    </svg>
  );
}

// The short note a section shows while the player has nothing to list in it.
function EmptyLegend({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-subtle">{text}</p>;
}

function ProfileSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Same layout as the loaded sections, so nothing shifts when they arrive.
export function ProfileSampleSectionsSkeleton() {
  return (
    <>
      <Skeleton className="h-24 w-full rounded-xl" />
      <SkeletonText widths={["w-44"]} className="font-display text-2xl" />
      <div className={medalGridClasses}>
        <Skeleton className="min-h-[17.5rem] rounded-xl sm:row-span-2 sm:min-h-[18.25rem]" />
        <Skeleton className="min-h-[7.875rem] rounded-xl" />
        <Skeleton className="min-h-[7.875rem] rounded-xl" />
      </div>
      <SkeletonText widths={["w-64 max-w-full"]} className="font-display text-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
      <SkeletonText widths={["w-44"]} className="font-display text-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-xl sm:h-14" />
        ))}
      </div>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-[4.25rem] rounded-xl" />
      ))}
      <SkeletonText widths={["w-36"]} className="font-display text-2xl" />
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-[6.5rem] rounded-xl" />
      ))}
      <SkeletonText widths={["w-52"]} className="font-display text-2xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
    </>
  );
}
