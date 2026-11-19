import type { Metadata } from "next";
import { Suspense } from "react";
import { GameGrid, GameGridSkeleton } from "@/components/game/GameGrid";
import { localeAlternates } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { games } = await getMessages();
  return {
    title: games.metaTitle,
    description: games.metaDescription,
    alternates: localeAlternates(locale, "/games"),
  };
}

export default async function GamesPage() {
  const { games } = await getMessages();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{games.title}</h1>
        <p className="text-lg leading-relaxed text-muted">{games.intro}</p>
      </header>
      <Suspense fallback={<GameGridSkeleton count={6} label={games.loading} />}>
        <GameGrid unavailable={games.unavailable} />
      </Suspense>
    </div>
  );
}
