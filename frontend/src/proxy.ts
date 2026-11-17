import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isLocale,
  localeCookie,
  localeCookieMaxAge,
  localizePath,
  locales,
  stripLocale,
  type Locale,
} from "@/i18n/config";

/** Locale routing. English URLs have no prefix and are rewritten to /en internally;
 *  /es and /pt URLs pass through; /en URLs redirect to their unprefixed form.
 *  An unprefixed visit goes to the saved language (cookie) or, on a first visit,
 *  to the browser's preferred language, which is then saved so detection runs once.
**/
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Social images are addressed by explicit locale (/en/opengraph-image); never redirect or detect.
  if (/\/(opengraph|twitter)-image(\/|$)/.test(pathname)) {
    return NextResponse.next();
  }

  const { locale: prefix, path } = stripLocale(pathname);

  if (prefix === defaultLocale) {
    return redirect(request, `${path}${search}`, 308);
  }

  if (prefix) {
    return NextResponse.next();
  }

  const saved = request.cookies.get(localeCookie)?.value;
  const savedLocale = saved && isLocale(saved) ? saved : null;
  const target = savedLocale ?? detectLocale(request.headers.get("accept-language"));

  if (target !== defaultLocale) {
    const response = redirect(request, `${localizePath(target, path)}${search}`, 307);
    if (!savedLocale) {
      response.cookies.set(localeCookie, target, {
        path: "/",
        maxAge: localeCookieMaxAge,
        sameSite: "lax",
      });
    }
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${path === "/" ? "" : path}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

function redirect(request: NextRequest, pathWithSearch: string, status: 307 | 308) {
  return NextResponse.redirect(new URL(pathWithSearch, request.url), status);
}

/** Pick the supported locale the browser prefers most, matching on the base language
 *  ("pt-PT" → "pt"). Falls back to the default locale.
**/
function detectLocale(header: string | null): Locale {
  if (!header) return defaultLocale;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      return { base: tag.toLowerCase().split("-")[0] ?? "", quality: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.base && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { base } of ranked) {
    const match = locales.find((locale) => locale === base);
    if (match) return match;
  }
  return defaultLocale;
}

export const config = {
  // Skip Next.js internals, API routes, and files with an extension (icon.svg, robots.txt).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
