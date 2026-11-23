import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AchievementRow } from "@/components/game/AchievementRow";
import { CommentsPreview } from "@/components/game/CommentsPreview";
import { ConsolePill } from "@/components/game/ConsolePill";
import { GameComments } from "@/components/game/GameComments";
import { GameDetailsCard } from "@/components/game/GameDetailsCard";
import { GameArt } from "@/components/game/GameArt";
import { GameArtCredits } from "@/components/game/GameArtCredits";
import { GameBackdrop } from "@/components/game/GameBackdrop";
import { consoleName } from "@/components/game/names";
import { PreviewNotice } from "@/components/game/PreviewNotice";
import { localeAlternates, localizePath } from "@/i18n/config";
import { interpolate, plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getGame, type GameDetail } from "@/lib/api/games";
import { GamePageSkeleton } from "./GamePageSkeleton";

type Props = PageProps<"/[lang]/games/[slug]">;

async function loadGame(slug: string): Promise<GameDetail | null | "unavailable"> {
  try {
    return await getGame(slug, await getLocale());
  } catch (error) {
    console.error(`Game "${slug}" unavailable`, error);
    return "unavailable";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const { game: text, notFound: notFoundText } = await getMessages();
  const game = await loadGame(slug);
  // The page streams, so an unknown game can't send a 404 status; noindex keeps it out of search.
  if (game === null) return { title: notFoundText.metaTitle, robots: { index: false } };
  if (game === "unavailable") return { title: text.allGames, robots: { index: false } };

  return {
    title: game.title,
    description: interpolate(text.metaDescription, { title: game.title, count: game.coreSet.achievementCount }),
    alternates: localeAlternates(locale, `/games/${game.slug}`),
  };
}

export default async function GamePage({ params }: Props) {
  const { game } = await getMessages();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<GamePageSkeleton label={game.loading} />}>
        <GameDetails params={params} />
      </Suspense>
    </div>
  );
}

async function GameDetails({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const locale = await getLocale();
  const { game: text, games, achievement, comments } = await getMessages();
  const game = await loadGame(slug);
  if (game === null) notFound();

  const backLink = (
    <Link href={localizePath(locale, "/games")} className="self-start text-sm text-muted hover:text-foreground">
      <span aria-hidden="true">← </span>
      {text.allGames}
    </Link>
  );
  if (game === "unavailable") {
    return (
      <>
        {backLink}
        <p className="text-muted">{text.unavailable}</p>
      </>
    );
  }

  const { coreSet } = game;
  return (
    <>
      {game.art?.hero && <GameBackdrop images={[game.art.hero.url]} eager />}
      {backLink}
      {/** Desktop: game info and achievements on the left, the details card on the right (sticky).
       *  Phones: the card comes right after the header, before the long achievement list.
      **/}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <header className="grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-center lg:col-start-1 lg:row-start-1">
          <GameArt
            image={game.art?.cover}
            game={game}
            variant="portrait"
            sizes="(min-width: 640px) 192px, 160px"
            loading="eager"
            className="w-40 sm:w-full"
          />
          <div className="flex flex-col gap-4">
            <ConsolePill
              originalPlatform={game.originalPlatform}
              label={interpolate(text.originalPlatform, { console: consoleName(game.originalPlatform) })}
            />
            <h1 translate="no" className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              {game.title}
            </h1>
            <p className="text-lg leading-relaxed text-muted">{game.summary}</p>
            <p className="font-mono text-sm text-subtle">
              {plural(locale, coreSet.achievementCount, games.achievementCount)} ·{" "}
              {plural(locale, coreSet.totalPoints, achievement.points)}
            </p>
          </div>
        </header>

        <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <GameDetailsCard game={game} />
        </div>

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-2">
          {coreSet.status === "preview" && <PreviewNotice title={text.previewTitle} text={text.previewText} />}

          <section aria-labelledby="achievements-heading" className="flex flex-col gap-4">
            <h2 id="achievements-heading" className="font-display text-2xl font-semibold">
              {text.achievementsHeading}
            </h2>
            <ul className="flex flex-col gap-3">
              {coreSet.achievements.map((item) => (
                <AchievementRow key={item.apiKeyName} achievement={item} />
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/** The signed-out form has the same layout, so nothing shifts when the visitor is known. **/}
      <Suspense fallback={<CommentsPreview labels={comments} locale={locale} viewer={null} />}>
        <GameComments />
      </Suspense>

      {game.art && <GameArtCredits art={game.art} />}
    </>
  );
}
