import type { ApiResult } from "@/lib/api/client";

/** Rules and error codes shared by the account forms' Server Actions. They mirror the API's own
 *  validation (which always runs too). Codes are translated by the client from auth.errors.
**/

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const usernamePattern = /^[A-Za-z0-9_-]{3,24}$/;
export const passwordMinLength = 8;
export const passwordMaxLength = 128;

// Human-verification action names; the server checks each token was issued for its form.
export const challengeActions = { signUp: "sign-up", forgotPassword: "forgot-password" } as const;

export type FieldError = "required" | "email" | "usernameFormat" | "passwordLength" | "passwordMismatch";

// Problem codes the API returns, plus the website's own form outcomes.
export type AuthError =
  | "invalid"
  | "username_taken"
  | "username_reserved"
  | "invalid_credentials"
  | "email_in_use"
  | "email_already_set"
  | "account_disabled"
  | "email_required"
  | "signup_expired"
  | "platform_refused"
  | "platform_unavailable"
  | "platform_linked_elsewhere"
  | "platform_already_connected"
  | "last_sign_in_method"
  | "account_muted"
  | "photo_not_allowed_yet"
  | "photo_invalid"
  | "photo_rights_required"
  | "photos_unavailable"
  | "cannot_report_self"
  | "moderation_forbidden"
  | "flow"
  | "not_signed_in"
  | "challenge"
  | "rateLimited"
  | "unavailable";

const apiCodes: readonly AuthError[] = [
  "username_taken",
  "username_reserved",
  "invalid_credentials",
  "email_in_use",
  "email_already_set",
  "account_disabled",
  "email_required",
  "signup_expired",
  "platform_refused",
  "platform_unavailable",
  "platform_linked_elsewhere",
  "platform_already_connected",
  "last_sign_in_method",
  "account_muted",
  "photo_not_allowed_yet",
  "photo_invalid",
  "photo_rights_required",
  "photos_unavailable",
  "cannot_report_self",
  "moderation_forbidden",
  "not_signed_in",
];

export function isAuthError(value: string): value is AuthError {
  return value === "invalid" || value === "flow" || value === "challenge" || value === "rateLimited" || value === "unavailable" || apiCodes.includes(value as AuthError);
}

// The error code for a failed API call: its problem code when known, else a generic outcome.
export function errorFrom(result: ApiResult<unknown>): AuthError {
  if (result.ok) return "unavailable";
  if (result.status === 429) return "rateLimited";
  const code = result.problem?.code;
  if (code && apiCodes.includes(code as AuthError)) return code as AuthError;
  if (result.status === 400) return "invalid";
  return "unavailable";
}

export function checkEmail(email: string): FieldError | null {
  if (!email) return "required";
  return emailPattern.test(email) && email.length <= 254 ? null : "email";
}

export function checkUsername(username: string): FieldError | null {
  if (!username) return "required";
  return usernamePattern.test(username) ? null : "usernameFormat";
}

export function checkPassword(password: string): FieldError | null {
  if (!password) return "required";
  return password.length >= passwordMinLength && password.length <= passwordMaxLength ? null : "passwordLength";
}

// The repeated password is only compared here; it's never sent to the API.
export function checkPasswordConfirmation(password: string, confirmation: string): FieldError | null {
  if (!confirmation) return "required";
  return password === confirmation ? null : "passwordMismatch";
}
