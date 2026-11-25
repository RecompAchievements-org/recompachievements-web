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
import { ReleaseBadge } from "./ReleaseBadge";
import { SiteMenu } from "./SiteMenu";

export async function SiteHeader() {
  const locale = await getLocale();
  const { header, localeSwitcher, common } = await getMessages();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={localizePath(locale, "/")}
            aria-label={interpolate(header.homeLabel, { siteName: siteConfig.name })}
            className="min-w-0 rounded-md"
          >
            <Logo />
          </Link>
          <ReleaseBadge href={localizePath(locale, siteConfig.releasePost)} label={header.release} className="hidden lg:inline-flex" />
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/** Wide screens show the main links in the row; narrower ones open them from SiteMenu. **/}
          <nav aria-label={header.mainNav} className="hidden lg:block">
            <ul className="flex items-center gap-1 text-sm font-medium">
              <li>
                <Link
                  href={localizePath(locale, "/games")}
                  className="rounded-md px-3 py-2 whitespace-nowrap text-muted transition-colors hover:text-foreground"
                >
                  {header.games}
                </Link>
              </li>
              <li>
                <Link
                  href={localizePath(locale, "/forum")}
                  className="rounded-md px-3 py-2 whitespace-nowrap text-muted transition-colors hover:text-foreground"
                >
                  {header.forum}
                </Link>
              </li>
              <li>
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
          <div className="lg:hidden">
            <SiteMenu
              label={header.menu}
              games={header.games}
              forum={header.forum}
              github={header.github}
              gamesHref={localizePath(locale, "/games")}
              forumHref={localizePath(locale, "/forum")}
              githubHref={siteConfig.repoUrl}
              newTabLabel={common.opensInNewTab}
            />
          </div>
        </div>
      </div>
      {/** The release badge is always shown; where the row has no room for it, it gets its own strip. **/}
      <div className="flex justify-center border-t border-border px-4 py-1.5 lg:hidden">
        <ReleaseBadge href={localizePath(locale, siteConfig.releasePost)} label={header.release} className="inline-flex" />
      </div>
    </header>
  );
}
