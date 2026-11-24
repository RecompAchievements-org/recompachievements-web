"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, localizePath, type Locale } from "@/i18n/config";
import { addEmail, deletePhoto, disconnectPlatform, forgotPassword, isPlatform, signOut, uploadPhoto } from "@/lib/api/accounts";
import { checkEmail, errorFrom, type AuthError, type FieldError } from "@/lib/auth/forms";
import { clearEmailOffer, clearSession, getCurrentAccount, visitor } from "@/lib/auth/session";

export type AddEmailState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: AuthError; email: string; fieldError: FieldError | null };

export type PasswordLinkState = { status: "idle" | "sent" } | { status: "error"; error: AuthError };

function localeFrom(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  return isLocale(raw) ? raw : "en";
}

// Starts our own email confirmation for an account without a confirmed email (also used to accept a platform's email offer).
export async function addEmailAction(_previous: AddEmailState, formData: FormData): Promise<AddEmailState> {
  const email = String(formData.get("email") ?? "").trim();
  const fieldError = checkEmail(email);
  if (fieldError) return { status: "error", error: "invalid", email, fieldError };

  try {
    const result = await addEmail(email, localeFrom(formData), await visitor());
    if (!result.ok) return { status: "error", error: errorFrom(result), email, fieldError: null };
    await clearEmailOffer();
    return { status: "sent", email };
  } catch (error) {
    console.error("Adding an email failed", error);
    return { status: "error", error: "unavailable", email, fieldError: null };
  }
}

export async function dismissEmailOffer(formData: FormData): Promise<void> {
  await clearEmailOffer();
  redirect(localizePath(localeFrom(formData), "/account/settings"));
}

// Sends the set-password link to the account's own confirmed email.
export async function sendPasswordLink(_previous: PasswordLinkState, formData: FormData): Promise<PasswordLinkState> {
  const account = await getCurrentAccount();
  if (!account) return { status: "error", error: "not_signed_in" };
  if (!account.email || !account.emailConfirmed) return { status: "error", error: "invalid" };

  try {
    const result = await forgotPassword(account.email, localeFrom(formData), await visitor());
    return result.ok ? { status: "sent" } : { status: "error", error: errorFrom(result) };
  } catch (error) {
    console.error("Sending a password link failed", error);
    return { status: "error", error: "unavailable" };
  }
}

const maxPhotoBytes = 1_000_000;

// The API decodes and re-creates the image and decides whether this account may upload.
export async function uploadPhotoAction(formData: FormData): Promise<AuthError | null> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > maxPhotoBytes) return "photo_invalid";
  if (formData.get("rights") !== "true") return "photo_rights_required";

  try {
    const result = await uploadPhoto(await photo.arrayBuffer(), await visitor());
    if (!result.ok) return errorFrom(result);
  } catch (error) {
    console.error("Uploading a profile photo failed", error);
    return "unavailable";
  }

  refresh();
  return null;
}

export async function deletePhotoAction(): Promise<AuthError | null> {
  try {
    const result = await deletePhoto(await visitor());
    if (!result.ok) return errorFrom(result);
  } catch (error) {
    console.error("Deleting a profile photo failed", error);
    return "unavailable";
  }

  refresh();
  return null;
}

export async function disconnectAction(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "");
  const settings = localizePath(localeFrom(formData), "/account/settings");
  if (!isPlatform(platform)) redirect(settings);

  let error: AuthError | null = null;
  try {
    const result = await disconnectPlatform(platform, await visitor());
    if (!result.ok) error = errorFrom(result);
  } catch (caught) {
    console.error("Disconnecting a platform failed", caught);
    error = "unavailable";
  }

  redirect(error ? `${settings}?error=${error}` : settings);
}

export async function signOutAction(formData: FormData): Promise<void> {
  try {
    await signOut(await visitor());
  } catch (error) {
    // The cookie is removed anyway; the API session then simply expires.
    console.error("Signing out failed", error);
  }
  await clearSession();
  redirect(localizePath(localeFrom(formData), "/"));
}
