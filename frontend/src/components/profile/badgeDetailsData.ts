import type { Locale } from "@/i18n/config";
import { formatDate, interpolate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { PublicPlayer } from "@/lib/api/accounts";
import type { RarityTier } from "@/lib/api/games";
import { sampleBadgeDate, type BadgeKind, type SampleBadge } from "./sampleBadges";

export interface BadgeDetailsData {
  kind: BadgeKind;
  rarity: RarityTier;
  name: string;
  kindLabel: string;
  rarityLabel: string;
  description: string;
  unlockedLabel: string;
}

// Translated, ready-to-show details of one badge for the BadgeDetails popover.
export function badgeDetailsData(badge: SampleBadge, player: PublicPlayer, locale: Locale, messages: Messages): BadgeDetailsData {
  const copy = messages.profile.badges;
  const date = formatDate(locale, sampleBadgeDate(badge, player), { dateStyle: "medium", timeZone: "UTC" });
  return {
    kind: badge.kind,
    rarity: badge.rarity,
    name: copy.items[badge.id],
    kindLabel: copy.kinds[badge.kind],
    rarityLabel: messages.rarity[badge.rarity],
    description: copy.descriptions[badge.id],
    unlockedLabel: interpolate(copy.unlocked, { date }),
  };
}
