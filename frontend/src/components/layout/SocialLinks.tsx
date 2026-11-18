import type { ReactNode } from "react";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { interpolate } from "@/i18n/format";
import { siteConfig } from "@/lib/site";

/** Simple original glyphs, not the networks' logos: code brackets for GitHub, an "r/" badge for
 *  Reddit, and a play button for YouTube. Each link's accessible name says where it goes.
**/
const networks: { key: keyof typeof siteConfig.social; name: string; icon: ReactNode }[] = [
  {
    key: "github",
    name: "GitHub",
    icon: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    key: "reddit",
    name: "Reddit",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
          r/
        </text>
      </>
    ),
  },
  {
    key: "youtube",
    name: "YouTube",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 9v6l5-3z" fill="currentColor" />
      </>
    ),
  },
];

export function SocialLinks({ label, linkLabel }: { label: string; linkLabel: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-3">
        {networks.map((network) => (
          <li key={network.key}>
            <ExternalLink
              href={siteConfig.social[network.key]}
              aria-label={interpolate(linkLabel, { siteName: siteConfig.name, network: network.name })}
              title={network.name}
              className="grid size-12 place-items-center rounded-xl border border-border-strong bg-surface-raised text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
                {network.icon}
              </svg>
            </ExternalLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
