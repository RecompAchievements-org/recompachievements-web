"use server";

import { redirect } from "next/navigation";
import { isLocale, localizePath } from "@/i18n/config";
import { completeSignup } from "@/lib/api/accounts";
import { checkUsername, errorFrom, type AuthError, type FieldError } from "@/lib/auth/forms";
import { clearPendingSignup, getPendingSignup, setSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/clientIp";

export type WelcomeState =
  | { status: "idle" }
  | { status: "error"; error: AuthError; username: string; fieldError: FieldError | "username_taken" | "username_reserved" | null };

/** Creates the account for the pending Discord/GitHub sign-up with the chosen username. The pending
 *  sign-up is read from its HttpOnly cookie, never from the form, so it can't be swapped.
**/
export async function createPlatformAccount(_previous: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const username = String(formData.get("username") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : "en";

  const fieldError = checkUsername(username);
  if (fieldError) return { status: "error", error: "invalid", username, fieldError };

  const pending = await getPendingSignup();
  if (!pending) return { status: "error", error: "signup_expired", username, fieldError: null };

  try {
    const result = await completeSignup(pending.pendingToken, username, locale, { clientIp: await getClientIp() });
    if (!result.ok) {
      const error = errorFrom(result);
      if (error === "signup_expired" || error === "platform_linked_elsewhere") await clearPendingSignup();
      return { status: "error", error, username, fieldError: error === "username_taken" || error === "username_reserved" ? error : null };
    }
    await setSession(result.data.token);
    await clearPendingSignup();
  } catch (error) {
    console.error("Creating a platform account failed", error);
    return { status: "error", error: "unavailable", username, fieldError: null };
  }

  redirect(localizePath(locale, "/account"));
}
