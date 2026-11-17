import type { MetadataRoute } from "next";
import { defaultLocale, htmlLang, localizePath, locales } from "@/i18n/config";
import { siteConfig } from "@/lib/site";

// Unprefixed paths of every public page; each is listed once per locale with hreflang links.
const publicPaths = ["/"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.flatMap((path) => {
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
