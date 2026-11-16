import { ExternalLink } from "@/components/ui/ExternalLink";
import { siteConfig } from "@/lib/site";
import { LogoMark } from "./Logo";

const linkClasses = "text-muted transition-colors hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-muted">
            <LogoMark className="size-6" />
            <span>{siteConfig.name}</span>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li>
                <ExternalLink href={siteConfig.repoUrl} className={linkClasses}>
                  Source code
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={siteConfig.securityPolicyUrl} className={linkClasses}>
                  Security
                </ExternalLink>
              </li>
              <li>
                <a href={`mailto:${siteConfig.contactEmail}`} className={linkClasses}>
                  Contact
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="max-w-3xl leading-relaxed text-subtle">
          Open source under the{" "}
          <ExternalLink href={siteConfig.licenseUrl} className="underline hover:text-foreground">
            AGPL-3.0
          </ExternalLink>
          . RecompAchievements tracks achievement definitions and player progress only. It does not
          host games, ROMs, or copyrighted assets, and is not affiliated with any game publisher,
          platform holder, or RetroAchievements.
        </p>
      </div>
    </footer>
  );
}
