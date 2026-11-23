import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { plural } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import type { PublicPlayer } from "@/lib/api/accounts";
import { BadgeDetails } from "./BadgeDetails";
import { badgeDetailsData } from "./badgeDetailsData";
import { BadgeIcon } from "./BadgeIcon";
import { bannerSampleBadges, sampleBadges } from "./sampleBadges";

// Up to six badges: two rows of three on phones, one row of six from tablets up.
const gridClasses = "grid grid-cols-3 gap-3 sm:grid-cols-6";

/** A compact card with the badges the player features (one to six) and the total they've earned,
 *  from rarest to most common. Sample data for now; players will choose these once badges are real.
**/
export async function ProfileBadges({ player }: { player: PublicPlayer }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { profile, progress } = messages;
  const copy = profile.badges;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{copy.heading}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{progress.sampleTitle}</Badge>
          <Badge tone="gold">{plural(locale, sampleBadges.length, copy.count)}</Badge>
        </div>
      </div>
      {sampleBadges.length === 0 ? (
        <p className="py-2 text-center text-sm text-subtle">{copy.none}</p>
      ) : (
        <ul className={gridClasses}>
          {bannerSampleBadges.map((badge) => (
            <li key={badge.id} className="min-w-0">
              <BadgeDetails
                details={badgeDetailsData(badge, player, locale, messages)}
                className="flex w-full flex-col items-center gap-1.5 rounded-md p-0.5 text-center transition-colors hover:bg-surface-raised"
              >
                <BadgeIcon kind={badge.kind} rarity={badge.rarity} className="h-auto w-9" />
                <span className="line-clamp-3 text-xs leading-tight font-medium text-muted">{copy.items[badge.id]}</span>
              </BadgeDetails>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Same layout as ProfileBadges, so nothing shifts when it arrives.
export function ProfileBadgesSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <SkeletonText widths={["w-24"]} className="font-display text-lg" />
      <div className={gridClasses}>
        {bannerSampleBadges.map((badge) => (
          <div key={badge.id} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-11 w-9" />
            <SkeletonText widths={["w-4/5", "w-1/2"]} className="w-full text-center text-xs leading-tight" />
          </div>
        ))}
      </div>
    </Card>
  );
}
