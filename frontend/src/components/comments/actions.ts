"use server";

import type { PlayerPreviewData } from "@/components/profile/PlayerPreview";
import { isLocale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
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
    return { username: result.data.username, memberSince: format(result.data.createdAt), lastActive: format(result.data.lastActiveOn) };
  } catch (error) {
    console.error("Loading a player preview failed", error);
    return null;
  }
}
