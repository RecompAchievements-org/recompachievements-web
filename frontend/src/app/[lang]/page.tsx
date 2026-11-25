import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryCard, CategoryCardSkeleton } from "@/components/forum/CategoryCard";
import { FeaturedSlider, FeaturedSliderSkeleton } from "@/components/game/FeaturedSlider";
import { GameGrid, GameGridSkeleton } from "@/components/game/GameGrid";
import { ButtonLink } from "@/components/ui/Button";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { JsonLd } from "@/components/seo/JsonLd";
import { htmlLang, localeAlternates, localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getForumCategories } from "@/lib/api/forum";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages = await getMessages();

  return {
    title: { absolute: `${siteConfig.name} · ${messages.home.metaTitle}` },
    alternates: localeAlternates(locale, "/"),
  };
}

// Home: the alpha call to action, the featured recomps slider, the game directory, and the latest news.
export default async function HomePage() {
  const locale = await getLocale();
  const { home, metadata, games, slider, forum } = await getMessages();

  /** Tells search engines who we are: the site's name (so results show "RecompAchievements" rather
   *  than the URL) and the organization behind it, with its logo and official profiles, so it isn't
   *  confused with similarly named projects.
  **/
  const organizationId = `${siteConfig.url}/#organization`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: siteConfig.name,
        url: `${siteConfig.url}/`,
        logo: `${siteConfig.url}/apple-icon.png`,
        email: siteConfig.contactEmail,
        sameAs: Object.values(siteConfig.social),
      },
      {
        "@type": "WebSite",
        name: siteConfig.name,
        alternateName: "Recomp Achievements",
        url: `${siteConfig.url}/`,
        description: metadata.description,
        inLanguage: htmlLang[locale],
        publisher: { "@id": organizationId },
      },
    ],
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-24">
      <JsonLd data={structuredData} />
      <section className="flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          {rich(home.title, {
            highlight: <span className="text-accent">{home.titleHighlight}</span>,
          })}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{home.intro}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={localizePath(locale, "/sign-up")}>{home.joinAlpha}</ButtonLink>
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
        {/** Short credit for the art in the grid and slider; each game page lists every artist. **/}
        <p className="text-sm text-muted">
          {rich(home.artSource, {
            source: (
              <ExternalLink href="https://www.steamgriddb.com/" className="text-foreground underline hover:text-accent">
                <span translate="no">SteamGridDB</span>
              </ExternalLink>
            ),
          })}
        </p>
      </section>

      {/** The News category card from the forum home, at full width: pinned posts and the five latest. **/}
      <Suspense fallback={<CategoryCardSkeleton label={forum.loading} />}>
        <LatestNews />
      </Suspense>
    </div>
  );
}

/** Loads the News category at request time from the shared "use cache" entry, like the game grid,
 *  and shows nothing if it is missing.
**/
async function LatestNews() {
  await connection();
  const locale = await getLocale();
  const { forum } = await getMessages();

  let news;
  try {
    news = (await getForumCategories(locale)).find((category) => category.key === siteConfig.newsCategory);
  } catch (error) {
    console.error("Latest news unavailable", error);
    return <p className="text-muted">{forum.unavailable}</p>;
  }

  return news ? <CategoryCard locale={locale} category={news} copy={forum} /> : null;
}
