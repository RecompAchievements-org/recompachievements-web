import { connection } from "next/server";
import { getLocale } from "@/i18n/server";
import { getGames } from "@/lib/api/games";
import { GameCard } from "./GameCard";

const gridClasses = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** Loads at request time (not during the build, which has no API) from the shared "use cache"
 *  entry, so it streams in almost instantly. Render it inside <Suspense> with GameGridSkeleton.
**/
export async function GameGrid({ limit, unavailable }: { limit?: number; unavailable: string }) {
  await connection();
  const locale = await getLocale();

  let games;
  try {
    games = await getGames(locale);
  } catch (error) {
    console.error("Game list unavailable", error);
    return <p className="text-muted">{unavailable}</p>;
  }

  return (
    <ul className={gridClasses}>
      {games.slice(0, limit).map((game) => (
        <li key={game.slug} className="flex">
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  );
}

export function GameGridSkeleton({ count = 3, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className={gridClasses}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex animate-pulse flex-col gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="aspect-video rounded-lg bg-surface-raised" />
          <div className="h-5 w-2/3 rounded bg-surface-raised" />
          <div className="h-4 w-full rounded bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}
