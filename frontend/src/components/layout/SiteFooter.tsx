import Link from "next/link";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { Logo } from "./Logo";
import { SocialLinks } from "./SocialLinks";

const linkClasses = "text-muted transition-colors hover:text-foreground";

export async function SiteFooter() {
  const locale = await getLocale();
  const { footer } = await getMessages();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-4">
            <Link href={localizePath(locale, "/")} className="self-start rounded-md">
              <Logo />
            </Link>
            <p className="leading-relaxed text-muted">{footer.tagline}</p>
            <SocialLinks label={footer.social} linkLabel={footer.socialLink} />
          </div>

          <nav aria-label={footer.nav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 md:pt-2">
              <li>
                <ExternalLink href={siteConfig.repoUrl} className={linkClasses}>
                  {footer.sourceCode}
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={siteConfig.securityPolicyUrl} className={linkClasses}>
                  {footer.security}
                </ExternalLink>
              </li>
              <li>
                <Link href={localizePath(locale, "/privacy")} className={linkClasses}>
                  {footer.privacy}
                </Link>
              </li>
              <li>
                <Link href={localizePath(locale, "/content-policy")} className={linkClasses}>
                  {footer.contentPolicy}
                </Link>
              </li>
              <li>
                <a href={`mailto:${siteConfig.contactEmail}`} className={linkClasses}>
                  {footer.contact}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="max-w-3xl leading-relaxed text-subtle">
          {rich(footer.license, {
            license: (
              <ExternalLink href={siteConfig.licenseUrl} className="underline hover:text-foreground">
                <span translate="no">AGPL-3.0</span>
              </ExternalLink>
            ),
          })}{" "}
          {footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
