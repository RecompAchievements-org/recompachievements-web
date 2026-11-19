import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { GameSummary } from "@/lib/api/games";
import { GameArt } from "./GameArt";

export async function GameCard({ game }: { game: GameSummary }) {
  const locale = await getLocale();
  const { games, achievement } = await getMessages();

  return (
    <Link
      href={localizePath(locale, `/games/${game.slug}`)}
      prefetch
      className="group flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <GameArt image={game.art?.hero} game={game} variant="card" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" />
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 translate="no" className="font-display text-lg leading-snug font-semibold group-hover:text-accent">
            {game.title}
          </h3>
          {game.setStatus === "preview" && <Badge tone="accent">{games.previewBadge}</Badge>}
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{game.summary}</p>
        <p className="font-mono text-sm text-subtle">
          {plural(locale, game.achievementCount, games.achievementCount)} ·{" "}
          {plural(locale, game.totalPoints, achievement.points)}
        </p>
      </div>
    </Link>
  );
}

// Same layout and sizes as GameCard, so the grid doesn't shift when the real cards arrive.
export function GameCardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <Skeleton className="aspect-video rounded-lg" />
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <SkeletonText widths={["w-3/4"]} className="flex-1 font-display text-lg leading-snug" />
          <Skeleton className="h-[22px] w-16" />
        </div>
        <SkeletonText widths={["w-full", "w-full", "w-1/2"]} className="text-sm leading-relaxed" />
        <SkeletonText widths={["w-1/2"]} className="font-mono text-sm" />
      </div>
    </div>
  );
}
