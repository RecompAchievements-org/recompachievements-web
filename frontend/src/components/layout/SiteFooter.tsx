import { ExternalLink } from "@/components/ui/ExternalLink";
import { rich } from "@/i18n/rich";
import { getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { LogoMark } from "./Logo";

const linkClasses = "text-muted transition-colors hover:text-foreground";

export async function SiteFooter() {
  const { footer } = await getMessages();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted">
            <LogoMark className="size-6" />
            <span translate="no">{siteConfig.name}</span>
          </div>

          <nav aria-label={footer.nav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
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
