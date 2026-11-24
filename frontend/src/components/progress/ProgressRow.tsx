import Link from "next/link";
import { GameArt } from "@/components/game/GameArt";
import { Card } from "@/components/ui/Card";
import { localizePath, type Locale } from "@/i18n/config";
import { formatNumber, interpolate, plural } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { SampleGameProgress } from "./sampleProgress";

export function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-surface-raised"
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

// "9 of 13 achievements · 49 pts", shared by the progress rows and the last game played.
export function progressLine({ game, unlocked, points }: SampleGameProgress, locale: Locale, messages: Messages) {
  return interpolate(messages.progress.gameLine, {
    unlocked: formatNumber(locale, unlocked),
    total: formatNumber(locale, game.achievementCount),
    points: plural(locale, points, messages.achievement.points),
  });
}

export function ProgressRow({ row, locale, messages }: { row: SampleGameProgress; locale: Locale; messages: Messages }) {
  const { game, percent } = row;

  return (
    <li>
      <Card className="flex items-center gap-4 p-4">
        <GameArt image={game.art?.icon ?? game.art?.cover} game={game} variant="thumb" sizes="64px" className="size-14 shrink-0 sm:size-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={localizePath(locale, `/games/${game.slug}`)} className="min-w-0 font-semibold wrap-anywhere hover:text-accent">
              {game.title}
            </Link>
            <span className="shrink-0 font-mono text-sm font-semibold text-gold">{`${formatNumber(locale, percent)}%`}</span>
          </div>
          <ProgressBar label={game.title} percent={percent} />
          <p className="text-sm text-muted">{progressLine(row, locale, messages)}</p>
        </div>
      </Card>
    </li>
  );
}
