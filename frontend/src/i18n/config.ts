/** Locale configuration shared by the proxy, Server Components, and Client Components.
 *  Keep this file free of server-only imports so every runtime can use it.
**/

export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];

// English has no URL prefix; every other locale lives under /<locale>.
export const defaultLocale: Locale = "en";

// Stores the visitor's chosen language; read by the proxy, written by the locale switcher.
export const localeCookie = "NEXT_LOCALE";
export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

// BCP 47 tags for <html lang>, hreflang, and Intl formatting.
export const htmlLang: Record<Locale, string> = {
  en: "en",
  es: "es",
  pt: "pt-BR",
};

export const openGraphLocale: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  pt: "pt_BR",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Turn an unprefixed path ("/games/x") into the URL for a locale ("/es/games/x").
export function localizePath(locale: Locale, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return normalized;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

/** Canonical URL and hreflang alternates for an unprefixed path, in the shape of the
 *  metadata `alternates` field. Every public page sets this in its metadata.
**/
export function localeAlternates(locale: Locale, path: string) {
  return {
    canonical: localizePath(locale, path),
    languages: {
      ...Object.fromEntries(locales.map((l) => [htmlLang[l], localizePath(l, path)])),
      "x-default": localizePath(defaultLocale, path),
    },
  };
}

/** Split a pathname into its locale prefix and the unprefixed path.
 *  "/es/games/x" → { locale: "es", path: "/games/x" }; "/games/x" → { locale: null, path: "/games/x" }.
**/
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first = "", ...rest] = pathname.split("/");
  if (isLocale(first)) {
    return { locale: first, path: `/${rest.join("/")}` };
  }
  return { locale: null, path: pathname || "/" };
}
