import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AchievementRow } from "@/components/game/AchievementRow";
import { GameArt } from "@/components/game/GameArt";
import { ImageCredit } from "@/components/game/ImageCredit";
import { consoleName, platformName } from "@/components/game/names";
import { PreviewNotice } from "@/components/game/PreviewNotice";
import { Badge } from "@/components/ui/Badge";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { localeAlternates, localizePath } from "@/i18n/config";
import { formatDate, interpolate, plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getGame, type GameDetail } from "@/lib/api/games";

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
      <Suspense fallback={<p role="status" className="text-muted">{game.loading}</p>}>
        <GameDetails params={params} />
      </Suspense>
    </div>
  );
}

async function GameDetails({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const locale = await getLocale();
  const { game: text, games, achievement, slider } = await getMessages();
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
      {backLink}
      <header className="grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start">
        <div className="flex flex-col gap-2">
          <GameArt game={game} sizes="(min-width: 768px) 352px, 100vw" priority />
          {game.heroImage && <ImageCredit image={game.heroImage} prefix={slider.imageCredit} />}
        </div>
        <div className="flex flex-col gap-4">
          <h1 translate="no" className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            {game.title}
          </h1>
          <p className="text-lg leading-relaxed text-muted">{game.summary}</p>
          <p className="text-sm text-muted">
            {[
              interpolate(text.originalPlatform, { console: consoleName(game.originalPlatform) }),
              game.latestVersion && interpolate(text.version, { version: game.latestVersion }),
              game.releasedAt &&
                interpolate(text.released, {
                  date: formatDate(locale, new Date(`${game.releasedAt}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" }),
                }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{text.platforms}</span>
            <ul className="flex flex-wrap gap-2">
              {game.platforms.map((platform) => (
                <li key={platform}>
                  <Badge className="tracking-normal! normal-case!">{platformName(platform)}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-sm text-subtle">
            {plural(locale, coreSet.achievementCount, games.achievementCount)} ·{" "}
            {plural(locale, coreSet.totalPoints, achievement.points)}
          </p>
          {game.repoUrl && (
            <ExternalLink href={game.repoUrl} className="self-start text-sm text-accent underline hover:text-accent-strong">
              {text.sourceCode}
            </ExternalLink>
          )}
        </div>
      </header>

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
    </>
  );
}
