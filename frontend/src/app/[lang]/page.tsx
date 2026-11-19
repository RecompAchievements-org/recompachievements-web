import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlphaOpenBadge } from "@/components/alpha/AlphaOpenBadge";
import { FeaturedSlider, FeaturedSliderSkeleton } from "@/components/game/FeaturedSlider";
import { GameGrid, GameGridSkeleton } from "@/components/game/GameGrid";
import { ButtonLink } from "@/components/ui/Button";
import { JsonLd } from "@/components/seo/JsonLd";
import { htmlLang, localeAlternates, localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages = await getMessages();

  return {
    title: { absolute: `${siteConfig.name} · ${messages.home.metaTitle}` },
    alternates: localeAlternates(locale, "/"),
  };
}

// Home: the alpha call to action, the featured recomps slider, and the game directory.
export default async function HomePage() {
  const locale = await getLocale();
  const { home, metadata, common, games, slider } = await getMessages();

  // Tells search engines the site's name, so results show "RecompAchievements" rather than the URL.
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    alternateName: "Recomp Achievements",
    url: `${siteConfig.url}/`,
    description: metadata.description,
    inLanguage: htmlLang[locale],
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-24">
      <JsonLd data={website} />
      <section className="flex max-w-3xl flex-col gap-6">
        <AlphaOpenBadge label={common.alphaOpen} href={localizePath(locale, "/alpha")} />
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          {rich(home.title, {
            highlight: <span className="text-accent">{home.titleHighlight}</span>,
          })}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{home.intro}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={localizePath(locale, "/alpha")}>{home.joinAlpha}</ButtonLink>
          <ButtonLink href={`mailto:${siteConfig.contactEmail}`} variant="secondary">
            {home.iBuildARecomp}
          </ButtonLink>
          <ButtonLink href={siteConfig.repoUrl} variant="ghost" external>
            {home.followOnGithub}
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="slider-heading" className="flex flex-col gap-6">
        <h2 id="slider-heading" className="font-display text-2xl font-semibold">
          {slider.heading}
        </h2>
        <Suspense fallback={<FeaturedSliderSkeleton label={games.loading} />}>
          <FeaturedSlider />
        </Suspense>
      </section>

      <section aria-labelledby="games-heading" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="games-heading" className="font-display text-2xl font-semibold">
            {home.allGamesHeading}
          </h2>
          <Link href={localizePath(locale, "/games")} className="text-sm text-accent hover:text-accent-strong">
            {home.browseAll} <span aria-hidden="true">→</span>
          </Link>
        </div>
        {/** The home page shows six games; the full list lives on /games, linked above. **/}
        <Suspense fallback={<GameGridSkeleton count={6} label={games.loading} />}>
          <GameGrid limit={6} unavailable={home.gamesUnavailable} />
        </Suspense>
      </section>
    </div>
  );
}
