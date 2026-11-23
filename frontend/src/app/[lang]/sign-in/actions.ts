"use server";

import { redirect } from "next/navigation";
import { isLocale, localizePath } from "@/i18n/config";
import { signIn } from "@/lib/api/accounts";
import { checkEmail, errorFrom, type AuthError, type FieldError } from "@/lib/auth/forms";
import { setSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/clientIp";

export type SignInState =
  | { status: "idle" }
  | { status: "error"; error: AuthError; email: string; fieldErrors: Partial<Record<"email" | "password", FieldError>> };

export async function signInWithEmail(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : "en";

  const fieldErrors: Partial<Record<"email" | "password", FieldError>> = {};
  const emailError = checkEmail(email);
  if (emailError) fieldErrors.email = emailError;
  // Only presence is checked here: any wrong password gets the API's single "incorrect" answer.
  if (!password) fieldErrors.password = "required";
  if (Object.keys(fieldErrors).length > 0) return { status: "error", error: "invalid", email, fieldErrors };

  try {
    const result = await signIn(email, password, { clientIp: await getClientIp() });
    if (!result.ok) return { status: "error", error: errorFrom(result), email, fieldErrors };
    await setSession(result.data.token);
  } catch (error) {
    console.error("Sign-in failed", error);
    return { status: "error", error: "unavailable", email, fieldErrors };
  }

  redirect(localizePath(locale, "/account"));
}
