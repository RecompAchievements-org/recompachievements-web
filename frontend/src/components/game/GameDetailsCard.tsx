import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { formatDate, interpolate, plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { GameDetail } from "@/lib/api/games";
import { GeneratedArt } from "./GeneratedArt";
import { consoleName, platformName } from "./names";
import { repoLinks } from "./repoLinks";

function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <ExternalLink
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-raised"
      >
        {children}
        <span aria-hidden="true" className="text-muted">↗</span>
      </ExternalLink>
    </li>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border py-3 text-sm">
      <dt className="shrink-0 whitespace-nowrap text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

// Side card on a game page: where to get the recomp, what players need, and its key facts.
export async function GameDetailsCard({ game }: { game: GameDetail }) {
  const locale = await getLocale();
  const { game: text, games, achievement } = await getMessages();
  const links = game.repoUrl ? repoLinks(game.repoUrl) : null;
  const consoleLabel = consoleName(game.originalPlatform);

  return (
    <aside aria-label={text.recompCard} className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-4">
        <GeneratedArt
          slug={game.slug}
          title={game.title}
          originalPlatform={game.originalPlatform}
          variant="thumb"
          className="size-20 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p translate="no" className="font-display text-lg leading-snug font-semibold">{game.title}</p>
          <p className="text-sm text-muted">{consoleLabel}</p>
        </div>
      </div>

      {links && (
        <div className="flex flex-col gap-3">
          <ButtonLink href={links.latestRelease ?? links.source} external className="w-full">
            {text.download}
          </ButtonLink>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <LinkRow href={links.source}>{text.sourceCode}</LinkRow>
            {links.releases && <LinkRow href={links.releases}>{text.allReleases}</LinkRow>}
            {links.issues && <LinkRow href={links.issues}>{text.reportIssue}</LinkRow>}
          </ul>
        </div>
      )}

      <p className="rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm leading-relaxed text-gold">
        <strong className="font-semibold">{text.youBring}</strong>{" "}
        {interpolate(text.youBringText, { game: game.originalGame, console: consoleLabel })}
      </p>

      <dl className="flex flex-col">
        <InfoRow label={text.platforms}>
          <ul className="flex flex-wrap justify-end gap-1.5">
            {game.platforms.map((platform) => (
              <li key={platform}>
                <Badge className="tracking-normal! normal-case!">{platformName(platform)}</Badge>
              </li>
            ))}
          </ul>
        </InfoRow>
        {game.latestVersion && <InfoRow label={text.latestVersion}>{game.latestVersion}</InfoRow>}
        {game.releasedAt && (
          <InfoRow label={text.releasedLabel}>
            {formatDate(locale, new Date(`${game.releasedAt}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" })}
          </InfoRow>
        )}
        <InfoRow label={text.license}>
          <span translate="no">{game.license ?? text.noLicense}</span>
        </InfoRow>
        <InfoRow label={text.achievements}>
          {plural(locale, game.coreSet.achievementCount, games.achievementCount)} ·{" "}
          {plural(locale, game.coreSet.totalPoints, achievement.points)}
        </InfoRow>
      </dl>
    </aside>
  );
}
