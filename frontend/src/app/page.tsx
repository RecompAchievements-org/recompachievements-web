import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { siteConfig } from "@/lib/site";

/** Placeholder home page until the game directory lands (frontend roadmap step 5).
 *  The preview card uses made-up sample values, not real player data.
**/
export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-24">
      <section className="flex max-w-3xl flex-col gap-6">
        <Badge tone="accent" className="self-start">
          Early development
        </Badge>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          Achievements for <span className="text-accent">native recomps</span>.
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          Track your progress in static recompilations and PC ports that run outside emulators.
          Recomp developers trigger achievements straight from native code; you collect points,
          chase rare unlocks, and show off your profile.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={siteConfig.repoUrl} external>
            Follow on GitHub
          </ButtonLink>
          <ButtonLink href={`mailto:${siteConfig.contactEmail}`} variant="secondary">
            I build a recomp
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
        <h2 id="preview-heading" className="font-display text-xl font-semibold text-muted">
          What you&apos;ll track
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
              <p className="font-semibold">First Boss Down</p>
              <p className="text-sm text-muted">Defeat the first boss without taking damage.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone="gold">25 pts</Badge>
                <Badge tone="epic">Epic · 4.2%</Badge>
                <Badge tone="success">Unlocked</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Completion</span>
              <span className="font-mono">18 / 40</span>
            </div>
            <ProgressBar value={45} label="Completion" />
          </div>
        </Card>
      </section>
    </div>
  );
}
