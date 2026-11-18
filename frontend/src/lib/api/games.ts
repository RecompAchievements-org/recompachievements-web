import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import { apiGet } from "./client";

export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AchievementKind = "progression" | "win_condition" | "standard";
export type SetStatus = "preview";

// An approved screenshot or banner; url is a path on this site, credit is already translated.
export interface GameImage {
  url: string;
  credit: string;
  sourceUrl: string | null;
}

export interface GameSummary {
  slug: string;
  title: string;
  originalPlatform: string;
  platforms: string[];
  summary: string;
  setStatus: SetStatus;
  achievementCount: number;
  totalPoints: number;
  featured: boolean;
  latestVersion: string | null;
  releasedAt: string | null;
  heroImage: GameImage | null;
}

export interface Achievement {
  apiKeyName: string;
  title: string;
  description: string;
  points: number;
  rarityTier: RarityTier;
  kind: AchievementKind;
  progressionStep: number | null;
}

export interface GameDetail {
  slug: string;
  title: string;
  originalPlatform: string;
  platforms: string[];
  summary: string;
  originalGame: string;
  repoUrl: string | null;
  license: string | null;
  latestVersion: string | null;
  releasedAt: string | null;
  heroImage: GameImage | null;
  coreSet: {
    status: SetStatus;
    achievementCount: number;
    totalPoints: number;
    achievements: Achievement[];
  };
}

/** Game data changes only when the API's catalog is deployed, so results are cached for hours
 *  and shared by every visitor. Failures throw and are not cached.
**/
export async function getGames(locale: Locale): Promise<GameSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("games");

  const result = await apiGet<GameSummary[]>(`/api/v1/games?lang=${locale}`);
  if (!result.ok) throw new Error(`Loading games failed with status ${result.status}.`);
  return result.data;
}

// Returns null for an unknown slug.
export async function getGame(slug: string, locale: Locale): Promise<GameDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("games", `game:${slug}`);

  const result = await apiGet<GameDetail>(`/api/v1/games/${encodeURIComponent(slug)}?lang=${locale}`);
  if (result.ok) return result.data;
  if (result.status === 404) return null;
  throw new Error(`Loading game "${slug}" failed with status ${result.status}.`);
}
