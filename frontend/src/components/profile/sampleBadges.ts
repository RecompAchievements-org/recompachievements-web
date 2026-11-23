import type { PublicPlayer } from "@/lib/api/accounts";
import type { RarityTier } from "@/lib/api/games";

export type BadgeKind = "award" | "recognition" | "role" | "event" | "contribution";
export type SampleBadgeId = "recompPioneer" | "sdkContributor" | "alphaMarathon" | "communityTranslator" | "bugHunter" | "weeklyChallenge" | "communityMember" | "firstComment";

export interface SampleBadge {
  id: SampleBadgeId;
  kind: BadgeKind;
  rarity: RarityTier;
  // Days after the player joined, so a sample date never comes before their account.
  unlockedAfterDays: number;
}

/** Mock badges shown on every public profile until real badges exist, always labeled as sample
 *  data and ordered from rarest to most common. Staff roles are left out on purpose, so no profile
 *  appears to hold authority. Delete this file when the API returns real badges.
**/
export const sampleBadges: SampleBadge[] = [
  { id: "recompPioneer", kind: "recognition", rarity: "legendary", unlockedAfterDays: 4 },
  { id: "sdkContributor", kind: "contribution", rarity: "epic", unlockedAfterDays: 3 },
  { id: "alphaMarathon", kind: "event", rarity: "rare", unlockedAfterDays: 2 },
  { id: "communityTranslator", kind: "role", rarity: "rare", unlockedAfterDays: 2 },
  { id: "bugHunter", kind: "recognition", rarity: "uncommon", unlockedAfterDays: 1 },
  { id: "weeklyChallenge", kind: "event", rarity: "uncommon", unlockedAfterDays: 1 },
  { id: "communityMember", kind: "award", rarity: "common", unlockedAfterDays: 0 },
  { id: "firstComment", kind: "award", rarity: "common", unlockedAfterDays: 0 },
];

const maxBannerBadges = 6;
const maxPhotoBadges = 3;

// What the profile shows; players will choose their own in both places once badges are real.
export const bannerSampleBadges = sampleBadges.slice(0, maxBannerBadges);
export const photoSampleBadges = sampleBadges.slice(0, maxPhotoBadges);

// A sample unlock date between the day the player joined and their last active day.
export function sampleBadgeDate(badge: SampleBadge, player: PublicPlayer): Date {
  const unlocked = new Date(player.createdAt).getTime() + badge.unlockedAfterDays * 24 * 60 * 60 * 1000;
  return new Date(Math.min(unlocked, new Date(player.lastActiveOn).getTime() + 24 * 60 * 60 * 1000 - 1));
}
