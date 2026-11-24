"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { isLocale, localizePath } from "@/i18n/config";
import { isPlatform, startOAuth } from "@/lib/api/accounts";
import { errorFrom } from "@/lib/auth/forms";
import { getSessionToken, setOAuthFlow, visitor } from "@/lib/auth/session";

/** Starts a Discord/GitHub sign-in ("sign-in") or connects one to the signed-in account
 *  ("connect"). The API builds the platform's authorize URL with a fresh state and PKCE verifier;
 *  both stay in an HttpOnly cookie until the platform redirects back to /auth/callback/<platform>.
**/
export async function startPlatform(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const mode = formData.get("mode") === "connect" ? "connect" : "sign-in";
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const back = localizePath(locale, mode === "connect" ? "/account/settings" : "/sign-in");

  if (!isPlatform(platform)) redirect(back);
  if (mode === "connect" && !(await getSessionToken())) redirect(localizePath(locale, "/sign-in"));

  let authorizeUrl: string;
  try {
    const result = await startOAuth(platform, await visitor());
    if (!result.ok) redirect(`${back}?error=${errorFrom(result)}`);
    await setOAuthFlow({ platform, state: result.data.state, codeVerifier: result.data.codeVerifier, mode, locale });
    authorizeUrl = result.data.authorizeUrl;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Starting a platform sign-in failed", error);
    redirect(`${back}?error=unavailable`);
  }

  redirect(authorizeUrl);
}
