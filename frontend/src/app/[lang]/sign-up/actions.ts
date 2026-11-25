"use server";

import { isLocale } from "@/i18n/config";
import { register } from "@/lib/api/accounts";
import { challengeActions, checkEmail, checkPassword, checkPasswordConfirmation, checkUsername, errorFrom, type AuthError, type FieldError } from "@/lib/auth/forms";
import { getClientIp } from "@/lib/clientIp";
import { verifyHumanToken } from "@/lib/turnstile";

type SignUpField = "email" | "username" | "password" | "confirmPassword";

export type SignUpState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: AuthError; values: { email: string; username: string }; fieldErrors: Partial<Record<SignUpField, FieldError | "username_taken" | "username_reserved">> };

/** Creates an email + password account. The API answers the same way whether or not the email
 *  already has an account (its owner gets an email instead), so the success screen never says more
 *  than "if this address can be used, we sent a link".
**/
export async function signUp(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const rawLocale = String(formData.get("locale") ?? "");
  const values = { email, username };

  const fieldErrors: Partial<Record<SignUpField, FieldError>> = {};
  const emailError = checkEmail(email);
  const usernameError = checkUsername(username);
  const passwordError = checkPassword(password);
  if (emailError) fieldErrors.email = emailError;
  if (usernameError) fieldErrors.username = usernameError;
  const confirmError = checkPasswordConfirmation(password, confirmPassword);
  if (passwordError) fieldErrors.password = passwordError;
  if (confirmError) fieldErrors.confirmPassword = confirmError;
  if (Object.keys(fieldErrors).length > 0 || !isLocale(rawLocale)) {
    return { status: "error", error: "invalid", values, fieldErrors };
  }

  const clientIp = await getClientIp();
  const human = await verifyHumanToken(String(formData.get("turnstileToken") ?? ""), challengeActions.signUp, clientIp);
  if (!human) return { status: "error", error: "challenge", values, fieldErrors };

  try {
    const result = await register({ email, password, username, locale: rawLocale }, { clientIp });
    if (result.ok) return { status: "sent", email };
    const error = errorFrom(result);
    if (error === "username_taken" || error === "username_reserved") return { status: "error", error, values, fieldErrors: { username: error } };
    return { status: "error", error, values, fieldErrors };
  } catch (error) {
    console.error("Sign-up failed", error);
    return { status: "error", error: "unavailable", values, fieldErrors };
  }
}
