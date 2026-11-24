import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Locale } from "@/i18n/config";
import { getMe, type Account, type Platform } from "@/lib/api/accounts";
import { getClientIp } from "@/lib/clientIp";

/** The only code that reads or writes the account cookies. Every cookie is HttpOnly (scripts can't
 *  read it) and SameSite=Lax. In production the session cookie uses the "__Host-" prefix, which the
 *  browser only accepts over HTTPS, for this exact host, on every path. Cookies are set only in
 *  Server Actions and Route Handlers; pages only read them.
**/

const secure = process.env.NODE_ENV === "production";
const sessionCookie = secure ? "__Host-session" : "session";
const oauthCookie = "oauth_flow";
const pendingCookie = "pending_signup";
const emailOfferCookie = "email_offer";

// Matches the API's longest session; the API ends idle sessions sooner and is the authority.
const sessionMaxAge = 60 * 60 * 24 * 180;
const shortMaxAge = 60 * 15;

const baseOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(sessionCookie)?.value ?? null;
}

export async function setSession(token: string): Promise<void> {
  (await cookies()).set(sessionCookie, token, { ...baseOptions, maxAge: sessionMaxAge });
}

export async function clearSession(): Promise<void> {
  await remove(sessionCookie);
}

/** The signed-in account for this request, or null. Deduplicated per request, so the header, the
 *  banner, and the page share one API call. An expired or revoked session reads as signed out.
**/
export const getCurrentAccount = cache(async (): Promise<Account | null> => {
  const session = await getSessionToken();
  if (!session) return null;

  try {
    const result = await getMe({ session, clientIp: await getClientIp() });
    return result.ok ? result.data : null;
  } catch (error) {
    console.error("Loading the signed-in account failed", error);
    return null;
  }
});

// The visitor context for API calls made on behalf of the signed-in visitor.
export async function visitor() {
  return { session: await getSessionToken(), clientIp: await getClientIp() };
}

/** A Discord/GitHub sign-in in progress: the state to check on return, the PKCE verifier, and
 *  whether it signs in or connects to the current account.
**/
export interface OAuthFlow {
  platform: Platform;
  state: string;
  codeVerifier: string;
  mode: "sign-in" | "connect";
  locale: Locale;
}

export async function setOAuthFlow(flow: OAuthFlow): Promise<void> {
  (await cookies()).set(oauthCookie, JSON.stringify(flow), { ...baseOptions, maxAge: shortMaxAge });
}

// Reads and removes the flow, so each one can be completed only once.
export async function takeOAuthFlow(): Promise<OAuthFlow | null> {
  const store = await cookies();
  const raw = store.get(oauthCookie)?.value;
  await remove(oauthCookie);
  return parse<OAuthFlow>(raw);
}

// A platform sign-up waiting for the welcome step (the API's signed token, plus what to show).
export interface PendingSignup {
  pendingToken: string;
  platform: Platform;
  email: string | null;
  suggestedUsername: string;
}

export async function setPendingSignup(pending: PendingSignup): Promise<void> {
  (await cookies()).set(pendingCookie, JSON.stringify(pending), { ...baseOptions, maxAge: shortMaxAge });
}

export async function getPendingSignup(): Promise<PendingSignup | null> {
  return parse<PendingSignup>((await cookies()).get(pendingCookie)?.value);
}

export async function clearPendingSignup(): Promise<void> {
  await remove(pendingCookie);
}

// A verified platform email offered to an account without one, shown on the account page until answered.
export interface EmailOffer {
  email: string;
  platform: Platform;
}

export async function setEmailOffer(offer: EmailOffer): Promise<void> {
  (await cookies()).set(emailOfferCookie, JSON.stringify(offer), { ...baseOptions, maxAge: shortMaxAge });
}

export async function getEmailOffer(): Promise<EmailOffer | null> {
  return parse<EmailOffer>((await cookies()).get(emailOfferCookie)?.value);
}

export async function clearEmailOffer(): Promise<void> {
  await remove(emailOfferCookie);
}

// Expires a cookie with the same attributes it was set with ("__Host-" cookies need Secure to be removed).
async function remove(name: string): Promise<void> {
  (await cookies()).set(name, "", { ...baseOptions, maxAge: 0 });
}

function parse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
