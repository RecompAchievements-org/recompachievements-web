import Link from "next/link";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { siteConfig } from "@/lib/site";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${siteConfig.name} home`} className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm font-medium">
            <li>
              <ExternalLink
                href={siteConfig.repoUrl}
                className="rounded-md px-3 py-2 text-muted transition-colors hover:text-foreground"
              >
                GitHub
              </ExternalLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
