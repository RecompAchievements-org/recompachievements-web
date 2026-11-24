"use server";

import { badgeDetailsData } from "@/components/profile/badgeDetailsData";
import type { PlayerPreviewData } from "@/components/profile/PlayerPreview";
import { photoSampleBadges } from "@/components/profile/sampleBadges";
import { isLocale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { loadMessages } from "@/i18n/server";
import { getPublicPlayer } from "@/lib/api/accounts";
import { usernamePattern } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

// Only public player fields, loaded when a comment author's preview first opens.
export async function loadPlayerPreview(username: string, locale: string): Promise<PlayerPreviewData | null> {
  if (!usernamePattern.test(username) || !isLocale(locale)) return null;

  try {
    const result = await getPublicPlayer(username, await visitor());
    if (!result.ok) return null;
    const format = (value: string) => formatDate(locale, new Date(value), { dateStyle: "medium", timeZone: "UTC" });
    const messages = await loadMessages(locale);
    return {
      username: result.data.username,
      memberSince: format(result.data.createdAt),
      lastActive: format(result.data.lastActiveOn),
      avatar: result.data.avatar,
      // Sample data, labeled in the preview, until players can choose real featured badges.
      badges: photoSampleBadges.map((badge) => {
        const { kind, rarity, name, rarityLabel } = badgeDetailsData(badge, result.data, locale, messages);
        return { id: badge.id, kind, rarity, name, rarityLabel };
      }),
    };
  } catch (error) {
    console.error("Loading a player preview failed", error);
    return null;
  }
}
