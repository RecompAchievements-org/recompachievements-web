import "server-only";
import { cacheLife } from "next/cache";
import type { Locale } from "@/i18n/config";
import { apiGet, apiSend, apiUpload, type ApiResult, type VisitorContext } from "./client";
import type { UserRole } from "./moderation";

export const platforms = ["discord", "github"] as const;
export type Platform = (typeof platforms)[number];

export function isPlatform(value: string): value is Platform {
  return (platforms as readonly string[]).includes(value);
}

export interface Session {
  token: string;
  expiresAt: string;
}

export interface PlayerAvatar {
  small: string;
  large: string;
}

export interface Account {
  id: string;
  username: string;
  email: string | null;
  emailConfirmed: boolean;
  hasPassword: boolean;
  discordConnected: boolean;
  githubConnected: boolean;
  canCollectAchievements: boolean;
  isAlphaTester: boolean;
  locale: Locale;
  createdAt: string;
  lastActivityAt: string;
  role: UserRole;
  isMuted: boolean;
  mutedUntil: string | null;
  avatar: PlayerAvatar | null;
}

// What anyone can see about a player. lastActiveOn is a date (YYYY-MM-DD) with no time.
export interface PublicPlayer {
  username: string;
  createdAt: string;
  lastActiveOn: string;
  avatar: PlayerAvatar | null;
}

export interface OAuthStart {
  authorizeUrl: string;
  state: string;
  codeVerifier: string;
}

export type OAuthSignIn =
  | { status: "signed-in"; session: Session }
  | { status: "pending"; pendingToken: string; email: string | null; suggestedUsername: string };

type Accepted = { status: string };

const base = "/api/v1/auth";

export const register = (input: { email: string; password: string; username: string; locale: Locale }, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/register`, input, visitor);

export const confirmEmail = (token: string, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/confirm-email`, { token }, visitor);

export const resendConfirmation = (email: string, locale: Locale, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/resend-confirmation`, { email, locale }, visitor);

export const signIn = (email: string, password: string, visitor: VisitorContext) =>
  apiSend<Session>("POST", `${base}/sign-in`, { email, password }, visitor);

export const signOut = (visitor: VisitorContext) => apiSend<void>("POST", `${base}/sign-out`, undefined, visitor);

export const getMe = (visitor: VisitorContext): Promise<ApiResult<Account>> => apiSend<Account>("GET", `${base}/me`, undefined, visitor);

// Also starts the first-password flow for accounts created through Discord or GitHub.
export const forgotPassword = (email: string, locale: Locale, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/forgot-password`, { email, locale }, visitor);

export const resetPassword = (token: string, password: string, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/reset-password`, { token, password }, visitor);

export const isUsernameAvailable = (username: string, visitor: VisitorContext) =>
  apiSend<{ available: boolean }>("GET", `${base}/usernames/available?username=${encodeURIComponent(username)}`, undefined, visitor);

export const addEmail = (email: string, locale: Locale, visitor: VisitorContext) =>
  apiSend<Accepted>("POST", `${base}/email/add`, { email, locale }, visitor);

export const uploadPhoto = (content: ArrayBuffer, visitor: VisitorContext) =>
  apiUpload<PlayerAvatar>(`${base}/photo?rightsConfirmed=true`, content, visitor);

export const deletePhoto = (visitor: VisitorContext) => apiSend<void>("DELETE", `${base}/photo`, undefined, visitor);

// A player's public information; a 404 means no such active player.
export const getPublicPlayer = (username: string, visitor: VisitorContext) =>
  apiSend<PublicPlayer>("GET", `/api/v1/users/${encodeURIComponent(username)}`, undefined, visitor);

// The platforms offered for sign-in (those configured on the API); the same for every visitor.
export async function getPlatforms(): Promise<Platform[]> {
  "use cache";
  cacheLife("hours");

  const result = await apiGet<{ providers: string[] }>(`${base}/providers`);
  if (!result.ok) throw new Error(`Loading sign-in platforms failed with status ${result.status}.`);
  return result.data.providers.filter(isPlatform);
}

export const startOAuth = (platform: Platform, visitor: VisitorContext) =>
  apiSend<OAuthStart>("POST", `${base}/oauth/${platform}/start`, {}, visitor);

export const completeOAuth = (platform: Platform, code: string, codeVerifier: string, visitor: VisitorContext) =>
  apiSend<OAuthSignIn>("POST", `${base}/oauth/${platform}/complete`, { code, codeVerifier }, visitor);

export const completeSignup = (pendingToken: string, username: string, locale: Locale, visitor: VisitorContext) =>
  apiSend<Session>("POST", `${base}/oauth/complete-signup`, { pendingToken, username, locale }, visitor);

export const connectPlatform = (platform: Platform, code: string, codeVerifier: string, visitor: VisitorContext) =>
  apiSend<{ provider: Platform; emailOffer: string | null }>("POST", `${base}/oauth/${platform}/connect`, { code, codeVerifier }, visitor);

export const disconnectPlatform = (platform: Platform, visitor: VisitorContext) =>
  apiSend<void>("DELETE", `${base}/connections/${platform}`, undefined, visitor);
