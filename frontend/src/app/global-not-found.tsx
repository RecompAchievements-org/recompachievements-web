import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
import { htmlLang, localeNames, localizePath, locales } from "@/i18n/config";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import type { Messages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { fontVariables } from "./fonts";
import "./globals.css";

/** Shown for URLs that match no route. It renders outside the [lang] layout, so it can't
 *  know which language the visitor wanted: it shows the message in every supported language.
**/
const messagesByLocale = { en, es, pt } satisfies Record<(typeof locales)[number], Messages>;

export const metadata: Metadata = {
  title: `${locales.map((locale) => messagesByLocale[locale].notFound.metaTitle).join(" · ")} · ${siteConfig.name}`,
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="grid min-h-full place-items-center px-4 py-16">
        <main className="flex w-full max-w-md flex-col gap-8">
          <div className="flex items-center gap-3">
            <LogoMark />
            <p className="font-mono text-sm text-accent">404</p>
          </div>

          <ul className="flex flex-col gap-6">
            {locales.map((locale) => {
              const { notFound } = messagesByLocale[locale];
              return (
                <li key={locale} lang={htmlLang[locale]} className="flex flex-col gap-1">
                  <h1 className="font-display text-2xl font-bold tracking-tight">
                    {notFound.title}
                  </h1>
                  <p className="text-muted">{notFound.description}</p>
                  <Link
                    href={localizePath(locale, "/")}
                    hrefLang={htmlLang[locale]}
                    className="self-start text-sm text-accent hover:text-accent-strong"
                  >
                    {notFound.backHome} · {localeNames[locale]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </main>
      </body>
    </html>
  );
}
