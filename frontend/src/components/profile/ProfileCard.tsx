import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { formatDate, formatNumber } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { PublicPlayer } from "@/lib/api/accounts";
import { BadgeDetails } from "./BadgeDetails";
import { badgeDetailsData } from "./badgeDetailsData";
import { BadgeIcon } from "./BadgeIcon";
import { ProfilePhoto } from "./ProfilePhoto";
import { StaffRibbon } from "./StaffRole";
import { photoSampleBadges } from "./sampleBadges";

const layoutClasses = "grid gap-5 p-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:p-6 lg:grid-cols-1";
const photoFrameClasses = "mx-auto w-32 sm:w-full";
const usernameClasses = "col-span-full min-w-0 font-display text-3xl font-bold tracking-tight wrap-anywhere";
const actionsClasses = "col-span-full flex flex-col gap-3 sm:flex-row lg:flex-col";
const dateOptions = { dateStyle: "medium", timeZone: "UTC" } as const;

/** The player's public summary on their profile: username on top, then photo and stats, with the
 *  page's actions at the bottom. Scoring doesn't exist until the SDK records unlocks,
 *  so every account has 0 points and no rank for now; replace these with API values then.
**/
const totalPoints = 0;
const eloPoints = 0;

export async function ProfileCard({ player, actions }: { player: PublicPlayer; actions: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { auth, profile } = messages;
  const copy = auth.profileCard;

  return (
    <Card aria-label={copy.label} role="region" className={layoutClasses}>
      <h1 className={usernameClasses}>{player.username}</h1>
      <div className={photoFrameClasses}>
        <div className="relative">
          <ProfilePhoto avatar={player.avatar} variant="large" label={copy.photoAlt} className="block aspect-square h-auto w-full rounded-lg" />
          {player.role && <StaffRibbon role={player.role} />}
        </div>
        {/** The row overlaps the photo's bottom edge, so badges stand out without covering a face. **/}
        <ul aria-label={profile.badges.displayed} className="relative -mt-[11.5%] flex justify-center gap-[3%]">
          {photoSampleBadges.map((badge) => (
            <li key={badge.id} className="w-[19%]">
              <BadgeDetails details={badgeDetailsData(badge, player, locale, messages)} className="block w-full rounded-md">
                <BadgeIcon kind={badge.kind} rarity={badge.rarity} className="block h-auto w-full" />
              </BadgeDetails>
            </li>
          ))}
        </ul>
      </div>
      <dl className="flex flex-col divide-y divide-border self-center">
        <Stat label={copy.totalPoints}>
          <span className="font-mono text-gold">{formatNumber(locale, totalPoints)}</span>
        </Stat>
        <Stat label={copy.eloPoints}>
          <span className="font-mono">{formatNumber(locale, eloPoints)}</span>
        </Stat>
        <Stat label={copy.ranking}>{copy.unranked}</Stat>
        <Stat label={copy.lastActivity}>
          <DateValue locale={locale} value={player.lastActiveOn} />
        </Stat>
        <Stat label={copy.memberSince}>
          <DateValue locale={locale} value={player.createdAt} />
        </Stat>
      </dl>
      <div className={actionsClasses}>{actions}</div>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold">{children}</dd>
    </div>
  );
}

function DateValue({ locale, value }: { locale: Awaited<ReturnType<typeof getLocale>>; value: string }) {
  return <time dateTime={value}>{formatDate(locale, new Date(value), dateOptions)}</time>;
}

// Same layout as ProfileCard, so nothing shifts when it arrives.
export function ProfileCardSkeleton() {
  return (
    <Card className={layoutClasses}>
      <SkeletonText widths={["w-48"]} className={usernameClasses} />
      <div className={photoFrameClasses}>
        <Skeleton className="aspect-square w-full rounded-lg" />
        <div aria-hidden="true" className="pb-[11.5%]" />
      </div>
      <div className="flex flex-col divide-y divide-border self-center">
        {["w-10", "w-10", "w-20", "w-24", "w-24"].map((width, index) => (
          <div key={index} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <SkeletonText widths={["w-24"]} className="text-sm" />
            <SkeletonText widths={[width]} className="text-sm" />
          </div>
        ))}
      </div>
      <div className={actionsClasses}>
        <Skeleton className="min-h-11 flex-1 rounded-lg" />
      </div>
    </Card>
  );
}
