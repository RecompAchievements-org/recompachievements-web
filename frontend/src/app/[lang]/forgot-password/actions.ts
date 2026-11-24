"use server";

import { isLocale } from "@/i18n/config";
import { forgotPassword } from "@/lib/api/accounts";
import { challengeActions, checkEmail, errorFrom, type AuthError, type FieldError } from "@/lib/auth/forms";
import { getClientIp } from "@/lib/clientIp";
import { verifyHumanToken } from "@/lib/turnstile";

export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: AuthError; email: string; fieldError: FieldError | null };

// The answer is the same whether or not the email has an account, a password, or a confirmed address.
export async function requestPasswordLink(_previous: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? "");

  const fieldError = checkEmail(email);
  if (fieldError || !isLocale(rawLocale)) return { status: "error", error: "invalid", email, fieldError };

  const clientIp = await getClientIp();
  const human = await verifyHumanToken(String(formData.get("turnstileToken") ?? ""), challengeActions.forgotPassword, clientIp);
  if (!human) return { status: "error", error: "challenge", email, fieldError: null };

  try {
    const result = await forgotPassword(email, rawLocale, { clientIp });
    if (result.ok) return { status: "sent" };
    return { status: "error", error: errorFrom(result), email, fieldError: null };
  } catch (error) {
    console.error("Password link request failed", error);
    return { status: "error", error: "unavailable", email, fieldError: null };
  }
}
