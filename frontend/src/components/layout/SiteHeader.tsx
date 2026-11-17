import Link from "next/link";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { localeNames, localizePath } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const locale = await getLocale();
  const { header, localeSwitcher } = await getMessages();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={localizePath(locale, "/")}
          aria-label={interpolate(header.homeLabel, { siteName: siteConfig.name })}
          className="min-w-0 rounded-md"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          {/** Hidden on phones to keep the header on one line; the footer links to GitHub too. **/}
          <nav aria-label={header.mainNav} className="hidden sm:block">
            <ul className="flex items-center gap-1 text-sm font-medium">
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
          <LocaleSwitcher
            current={locale}
            buttonLabel={interpolate(localeSwitcher.button, { language: localeNames[locale] })}
            menuLabel={localeSwitcher.label}
          />
        </div>
      </div>
    </header>
  );
}
