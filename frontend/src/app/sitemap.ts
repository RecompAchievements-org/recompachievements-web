import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { defaultLocale, htmlLang, localizePath, locales } from "@/i18n/config";
import { getForumCategories, getForumPosts } from "@/lib/api/forum";
import { getGames } from "@/lib/api/games";
import { siteConfig } from "@/lib/site";

// Unprefixed paths of every static public page; each is listed once per locale with hreflang links.
const publicPaths = ["/", "/alpha", "/games", "/forum", "/privacy", "/content-policy", "/rules"];

// Game pages come from the API at request time; if it's unreachable, the static pages are still listed.
async function gamePaths(): Promise<string[]> {
  try {
    return (await getGames(defaultLocale)).map((game) => `/games/${game.slug}`);
  } catch (error) {
    console.error("Sitemap: game list unavailable", error);
    return [];
  }
}

// Forum categories and their published posts come from the API too; it's skipped if unreachable.
async function forumPaths(): Promise<string[]> {
  try {
    const paths: string[] = [];
    for (const category of await getForumCategories(defaultLocale)) {
      paths.push(`/forum/${category.key}`);
      for (let page = 1; page <= 50; page++) {
        const result = await getForumPosts(category.key, page, defaultLocale);
        if (!result) break;
        paths.push(...result.posts.map((post) => `/forum/${category.key}/${post.slug}`));
        if (page >= result.totalPages) break;
      }
    }
    return paths;
  } catch (error) {
    console.error("Sitemap: forum unavailable", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const paths = [...publicPaths, ...(await gamePaths()), ...(await forumPaths())];

  return paths.flatMap((path) => {
    const languages = {
      ...Object.fromEntries(
        locales.map((locale) => [htmlLang[locale], `${siteConfig.url}${localizePath(locale, path)}`]),
      ),
      "x-default": `${siteConfig.url}${localizePath(defaultLocale, path)}`,
    };

    return locales.map((locale) => ({
      url: `${siteConfig.url}${localizePath(locale, path)}`,
      alternates: { languages },
    }));
  });
}
