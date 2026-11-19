import { connection } from "next/server";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { formatDate, interpolate, plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getGames, type GameSummary } from "@/lib/api/games";
import { GameArt } from "./GameArt";
import { consoleName } from "./names";
import { SliderControls } from "./SliderControls";

// The slider keeps to five recomps; the home grid shows six, and /games lists every game.
const maxSlides = 5;
const newReleaseDays = 30;

/** Featured games in the catalog's display order (the API already sorts by it), so the order is
 *  curated: the launch target stays first even when newer games are featured. If none are
 *  featured, the newest releases fill the slider instead.
**/
function pickSlides(games: GameSummary[]) {
  const featured = games.filter((game) => game.featured);
  if (featured.length > 0) return featured.slice(0, maxSlides);
  const byRelease = (a: GameSummary, b: GameSummary) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
  return games.toSorted(byRelease).slice(0, maxSlides);
}

const releaseDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

// Runs at request time (the slider loads after connection()), so "now" is the visit's time.
function isNewRelease(game: GameSummary) {
  return game.releasedAt !== null && Date.now() - releaseDate(game.releasedAt).getTime() < newReleaseDays * 86_400_000;
}

/** Homepage slider of featured recomps. Loads at request time like GameGrid (render it inside
 *  <Suspense> with FeaturedSliderSkeleton); renders nothing if the API is unavailable, since the
 *  games grid below shows that message.
**/
export async function FeaturedSlider() {
  await connection();
  const locale = await getLocale();
  const { slider, game: gameText, games: gamesText } = await getMessages();

  let games;
  try {
    games = pickSlides(await getGames(locale));
  } catch {
    return null;
  }
  if (games.length === 0) return null;

  const slides = games.map((game, index) => {
    const href = localizePath(locale, `/games/${game.slug}`);
    const release = [
      game.latestVersion && interpolate(gameText.version, { version: game.latestVersion }),
      game.releasedAt &&
        interpolate(gameText.released, { date: formatDate(locale, releaseDate(game.releasedAt), { dateStyle: "medium", timeZone: "UTC" }) }),
    ].filter(Boolean);

    return (
      <div key={game.slug} className="grid h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-10 lg:order-1">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isNewRelease(game) ? "gold" : "accent"}>
              {isNewRelease(game) ? slider.newRelease : slider.featured}
            </Badge>
            <span className="text-sm text-muted">{consoleName(game.originalPlatform)}</span>
          </div>
          <h3 translate="no" className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {game.title}
          </h3>
          <p className="line-clamp-3 leading-relaxed text-muted">{game.summary}</p>
          <p className="font-mono text-sm text-subtle">
            {[...release, plural(locale, game.achievementCount, gamesText.achievementCount)].join(" · ")}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href={href} prefetch>
              {slider.viewAchievements}
            </ButtonLink>
          </div>
        </div>
        <div className="relative order-1 flex flex-col lg:order-2">
          <GameArt
            image={game.art?.hero}
            game={game}
            variant="wide"
            sizes="(min-width: 1024px) 640px, 100vw"
            loading={index === 0 ? "eager" : undefined}
            fetchPriority={index === 0 ? "high" : undefined}
            className="min-h-56 flex-1 sm:min-h-72 lg:min-h-96"
          />
          {game.art?.hero && (
            <ExternalLink
              href={game.art.hero.sourceUrl}
              className="absolute right-3 bottom-2 rounded bg-background/75 px-2 py-0.5 text-xs text-muted hover:text-foreground"
            >
              {interpolate(slider.artCredit, { author: game.art.hero.author })}
            </ExternalLink>
          )}
        </div>
      </div>
    );
  });

  return (
    <SliderControls
      slides={slides}
      backdrops={games.map((game) => game.art?.hero?.url ?? null)}
      rail={games.map((game, index) => ({
        title: game.title,
        subtitle: consoleName(game.originalPlatform),
        slideLabel: interpolate(slider.slide, { current: index + 1, total: games.length }),
      }))}
      labels={{
        carousel: slider.carousel,
        pause: slider.pause,
        play: slider.play,
        previous: slider.previous,
        next: slider.next,
      }}
    />
  );
}

/** Same structure and sizes as a slide plus the rail and controls (SliderControls), so the home
 *  page doesn't shift when the slider arrives. The title and the meta line take two lines each,
 *  like the longest slides.
**/
export function FeaturedSliderSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <div className="grid overflow-hidden rounded-2xl border border-border bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-10 lg:order-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[22px] w-24" />
            <SkeletonText widths={["w-24"]} className="text-sm" />
          </div>
          <SkeletonText widths={["w-4/5", "w-1/2"]} className="font-display text-3xl leading-tight sm:text-4xl" />
          <SkeletonText widths={["w-full", "w-full", "w-2/3"]} className="leading-relaxed" />
          <SkeletonText widths={["w-3/4", "w-1/3"]} className="font-mono text-sm" />
          <div className="pt-2">
            <Skeleton className="h-11 w-44 rounded-lg" />
          </div>
        </div>
        <Skeleton className="order-1 min-h-56 rounded-none sm:min-h-72 lg:order-2 lg:min-h-96" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-hidden pb-1">
          {Array.from({ length: maxSlides }, (_, index) => (
            <div key={index} className="flex min-w-40 flex-1 flex-col gap-1 rounded-lg border border-border bg-surface px-3 py-2">
              <SkeletonText widths={["w-3/4"]} className="text-sm" />
              <SkeletonText widths={["w-1/2"]} className="text-xs" />
              <Skeleton className="mt-1 h-0.5 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="size-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
