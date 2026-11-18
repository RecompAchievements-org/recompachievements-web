import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { localizePath } from "@/i18n/config";
import { plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { GameSummary } from "@/lib/api/games";
import { GeneratedArt } from "./GeneratedArt";

export async function GameCard({ game }: { game: GameSummary }) {
  const locale = await getLocale();
  const { games, achievement } = await getMessages();

  return (
    <Link
      href={localizePath(locale, `/games/${game.slug}`)}
      prefetch
      className="group flex w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <GeneratedArt slug={game.slug} title={game.title} originalPlatform={game.originalPlatform} />
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
