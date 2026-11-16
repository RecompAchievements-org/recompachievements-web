import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { localeAlternates } from "@/i18n/config";
import { formatNumber, formatPercent, plural } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages = await getMessages();

  return {
    title: { absolute: `${siteConfig.name} · ${messages.home.metaTitle}` },
    alternates: localeAlternates(locale, "/"),
  };
}

/** Placeholder home page until the game directory lands (frontend roadmap step 5).
 *  The preview card uses made-up sample values, not real player data.
**/
export default async function HomePage() {
  const locale = await getLocale();
  const { home, achievement, rarity } = await getMessages();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-24">
      <section className="flex max-w-3xl flex-col gap-6">
        <Badge tone="accent" className="self-start">
          {home.badge}
        </Badge>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          {rich(home.title, {
            highlight: <span className="text-accent">{home.titleHighlight}</span>,
          })}
        </h1>
        <p className="text-lg leading-relaxed text-muted">{home.intro}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={siteConfig.repoUrl} external>
            {home.followOnGithub}
          </ButtonLink>
          <ButtonLink href={`mailto:${siteConfig.contactEmail}`} variant="secondary">
            {home.iBuildARecomp}
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
        <h2 id="preview-heading" className="font-display text-xl font-semibold text-muted">
          {home.previewHeading}
        </h2>

        <Card className="flex max-w-xl flex-col gap-4">
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="grid size-14 shrink-0 place-items-center rounded-lg border border-gold/40 bg-surface-raised font-display text-2xl text-gold"
            >
              ★
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-semibold">{home.sampleTitle}</p>
              <p className="text-sm text-muted">{home.sampleDescription}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone="gold">{plural(locale, 25, achievement.points)}</Badge>
                <Badge tone="epic">
                  {rarity.epic} · {formatPercent(locale, 4.2)}
                </Badge>
                <Badge tone="success">{home.unlocked}</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">{home.completion}</span>
              <span className="font-mono">
                {formatNumber(locale, 18)} / {formatNumber(locale, 40)}
              </span>
            </div>
            <ProgressBar value={45} label={home.completion} />
          </div>
        </Card>
      </section>
    </div>
  );
}
