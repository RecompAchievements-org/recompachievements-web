import "server-only";
import type { Locale } from "@/i18n/config";
import { apiPost, type ApiResult } from "./client";

export const platforms = ["windows", "linux", "macos", "steam_deck"] as const;
export type Platform = (typeof platforms)[number];

export interface AlphaSignupInput {
  email: string;
  nickname: string;
  platforms: Platform[];
  recomps: string | null;
  locale: Locale;
  consent: boolean;
}

export function createAlphaSignup(
  input: AlphaSignupInput,
  clientIp: string | null,
): Promise<ApiResult<{ status: string }>> {
  return apiPost("/api/v1/alpha-signups", input, { clientIp });
}

export function confirmAlphaSignup(
  token: string,
  clientIp: string | null,
): Promise<ApiResult<{ status: string }>> {
  return apiPost("/api/v1/alpha-signups/confirm", { token }, { clientIp });
}
