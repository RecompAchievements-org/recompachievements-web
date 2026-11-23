"use server";

import { resetPassword } from "@/lib/api/accounts";
import { checkPassword, checkPasswordConfirmation, type FieldError } from "@/lib/auth/forms";
import { getClientIp } from "@/lib/clientIp";

export type ResetPasswordState =
  | { status: "idle" | "saved" | "expired" | "invalid" | "unavailable" | "rateLimited" }
  | { status: "fieldError"; field: "password" | "confirmPassword"; fieldError: FieldError };

// Sets the password (a first one, or a new one) with the emailed link; the API signs out every session.
export async function savePassword(_previous: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!token) return { status: "invalid" };

  const fieldError = checkPassword(password);
  if (fieldError) return { status: "fieldError", field: "password", fieldError };

  const confirmError = checkPasswordConfirmation(password, String(formData.get("confirmPassword") ?? ""));
  if (confirmError) return { status: "fieldError", field: "confirmPassword", fieldError: confirmError };

  try {
    const result = await resetPassword(token, password, { clientIp: await getClientIp() });
    if (result.ok) return { status: "saved" };
    if (result.status === 410) return { status: "expired" };
    if (result.status === 404) return { status: "invalid" };
    if (result.status === 429) return { status: "rateLimited" };
    if (result.status === 400) return { status: "fieldError", field: "password", fieldError: "passwordLength" };
  } catch (error) {
    console.error("Saving a password failed", error);
  }
  return { status: "unavailable" };
}
