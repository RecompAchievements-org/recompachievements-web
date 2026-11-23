import type { Achievement, GameSummary } from "@/lib/api/games";

export interface SampleGameProgress {
  game: GameSummary;
  unlocked: number;
  points: number;
  percent: number;
}

const sampleCompletion = [1, 0.72, 0.45, 0.18];

/** Mock completion shown on /progress pages and public profiles until real unlocks exist: the same
 *  fixed shares of real catalog games, for everyone, always labeled as sample data. Delete this
 *  file when the API returns real progress.
**/
export function buildSampleProgress(games: GameSummary[]): SampleGameProgress[] {
  return games
    .filter((game) => game.achievementCount > 0)
    .slice(0, sampleCompletion.length)
    .map((game, index) => {
      const share = sampleCompletion[index] ?? 0;
      const unlocked = Math.round(game.achievementCount * share);
      return {
        game,
        unlocked,
        points: Math.round(game.totalPoints * share),
        percent: Math.round((unlocked / game.achievementCount) * 100),
      };
    });
}

const sampleAchievementCount = 6;

// The highest-value achievements of a game, shown as sample recent achievements.
export function sampleAchievements(achievements: Achievement[]): Achievement[] {
  return [...achievements].sort((a, b) => b.points - a.points).slice(0, sampleAchievementCount);
}

export const medalTiers = ["platinum", "gold", "silver"] as const;
export type MedalTier = (typeof medalTiers)[number];

// How many games each medal card can feature; players will choose them once medals are real.
const maxFeaturedGames: Record<MedalTier, number> = { platinum: 3, gold: 1, silver: 1 };

export interface SampleMedal {
  tier: MedalTier;
  // The games shown on the medal card; empty when the player has none of this tier.
  featured: GameSummary[];
  total: number;
}

/** Sample medals: a game counts once, at its highest tier. Platinum holds more games than it can
 *  feature, to show that the total can be higher, and Silver stays empty to show that state.
**/
export function sampleMedals(games: GameSummary[], rows: SampleGameProgress[]): SampleMedal[] {
  const others = games.filter((game) => game.achievementCount > 0 && !rows.some((row) => row.game.slug === game.slug));
  const earned: Record<MedalTier, GameSummary[]> = {
    platinum: [...rows.slice(0, 1).map((row) => row.game), ...others.slice(0, 3)],
    gold: rows.slice(1, 2).map((row) => row.game),
    silver: [],
  };
  return medalTiers.map((tier) => ({
    tier,
    featured: earned[tier].slice(0, maxFeaturedGames[tier]),
    total: earned[tier].length,
  }));
}

export type SubsetType = "dlc" | "mod" | "randomizer" | "challenge";
export type SubsetStatus = "mastered" | "beaten";

export interface SampleSubset {
  game: GameSummary;
  type: SubsetType;
  status: SubsetStatus;
}

// Sample subset results; the catalog has no real subsets yet, so they're named by type.
export function sampleSubsets(rows: SampleGameProgress[]): SampleSubset[] {
  const samples: { row: number; type: SubsetType; status: SubsetStatus }[] = [
    { row: 0, type: "challenge", status: "mastered" },
    { row: 0, type: "dlc", status: "beaten" },
    { row: 1, type: "randomizer", status: "beaten" },
  ];
  return samples.flatMap(({ row, type, status }) => {
    const game = rows[row]?.game;
    return game ? [{ game, type, status }] : [];
  });
}
