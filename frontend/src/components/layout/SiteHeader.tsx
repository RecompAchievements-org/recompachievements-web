import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { localeNames, localizePath } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { AccountLink, SignInLink } from "./AccountLink";
import { LocaleFlag } from "./LocaleFlag";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const locale = await getLocale();
  const { header, localeSwitcher } = await getMessages();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link
          href={localizePath(locale, "/")}
          aria-label={interpolate(header.homeLabel, { siteName: siteConfig.name })}
          className="min-w-0 rounded-md"
        >
          <Logo compact />
        </Link>

        <div className="flex shrink-0 items-center sm:gap-1">
          <nav aria-label={header.mainNav}>
            <ul className="flex items-center gap-1 text-sm font-medium">
              <li>
                <Link
                  href={localizePath(locale, "/games")}
                  className="rounded-md px-1.5 py-2 whitespace-nowrap text-muted transition-colors hover:text-foreground sm:px-3"
                >
                  {header.games}
                </Link>
              </li>
              <li>
                <Link
                  href={localizePath(locale, "/forum")}
                  className="rounded-md px-1.5 py-2 whitespace-nowrap text-muted transition-colors hover:text-foreground sm:px-3"
                >
                  {header.forum}
                </Link>
              </li>
              {/** Shown only on wide screens to keep the header on one line; the footer links to GitHub too. **/}
              <li className="hidden lg:block">
                <ExternalLink
                  href={siteConfig.repoUrl}
                  className="rounded-md px-3 py-2 whitespace-nowrap text-muted transition-colors hover:text-foreground"
                >
                  <span translate="no">{header.github}</span>
                </ExternalLink>
              </li>
            </ul>
          </nav>
          {/** The account link reads the session cookie, known only per request; "Sign In" shows until then. **/}
          <Suspense fallback={<SignInLink />}>
            <AccountLink />
          </Suspense>
          {/** The switcher reads the current URL, which pages with unlisted params (games) only
           *  know at request time; the fallback shows the flag until it streams in.
          **/}
          <Suspense
            fallback={
              <span className="flex h-9 items-center px-1 pr-4.5 sm:px-2 sm:pr-6">
                <LocaleFlag locale={locale} />
              </span>
            }
          >
            <LocaleSwitcher
              current={locale}
              buttonLabel={interpolate(localeSwitcher.button, { language: localeNames[locale] })}
              menuLabel={localeSwitcher.label}
            />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
