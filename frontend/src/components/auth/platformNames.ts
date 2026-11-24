import type { Platform } from "@/lib/api/accounts";

// Brand names stay in English in every locale.
export const platformNames: Record<Platform, string> = {
  discord: "Discord",
  github: "GitHub",
};
