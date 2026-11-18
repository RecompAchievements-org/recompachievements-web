"use server";

import { isLocale } from "@/i18n/config";
import { createAlphaSignup, platforms, type Platform } from "@/lib/api/alphaSignups";
import { getClientIp } from "@/lib/clientIp";
import { verifyHumanToken } from "@/lib/turnstile";
import { challengeAction } from "./challenge";

export type SignupField = "email" | "nickname" | "platforms" | "recomps" | "consent";
export type SignupErrorCode =
  | "required"
  | "email"
  | "nicknameLength"
  | "platforms"
  | "recompsLength"
  | "consent";

export interface SignupValues {
  email: string;
  nickname: string;
  platforms: string[];
  recomps: string;
  consent: boolean;
}

export type SignupState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "invalid"; fieldErrors: Partial<Record<SignupField, SignupErrorCode>>; values: SignupValues }
  | { status: "error"; error: "challenge" | "rateLimited" | "unavailable"; values: SignupValues };

// Humans need a few seconds to fill the form; scripts that post instantly are ignored.
const minimumFillMs = 3000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readValues(formData: FormData): SignupValues {
  return {
    email: String(formData.get("email") ?? "").trim(),
    nickname: String(formData.get("nickname") ?? "").trim(),
    platforms: formData.getAll("platforms").map(String),
    recomps: String(formData.get("recomps") ?? "").trim(),
    consent: formData.get("consent") === "on",
  };
}

function validate(values: SignupValues): Partial<Record<SignupField, SignupErrorCode>> {
  const errors: Partial<Record<SignupField, SignupErrorCode>> = {};
  if (!values.email) errors.email = "required";
  else if (!emailPattern.test(values.email) || values.email.length > 254) errors.email = "email";
  if (!values.nickname) errors.nickname = "required";
  else if (values.nickname.length < 2 || values.nickname.length > 32) errors.nickname = "nicknameLength";
  if (values.platforms.length === 0 || values.platforms.some((p) => !platforms.includes(p as Platform)))
    errors.platforms = "platforms";
  if (values.recomps.length > 200) errors.recomps = "recompsLength";
  if (!values.consent) errors.consent = "consent";
  return errors;
}

// Maps API validation keys (e.g. "Email") to form fields.
function fieldFromApi(key: string): SignupField | null {
  const field = key.charAt(0).toLowerCase() + key.slice(1);
  return (["email", "nickname", "platforms", "recomps", "consent"] as const).find((f) => f === field) ?? null;
}

const apiErrorCode: Record<SignupField, SignupErrorCode> = {
  email: "email",
  nickname: "nicknameLength",
  platforms: "platforms",
  recomps: "recompsLength",
  consent: "consent",
};

export async function signUpForAlpha(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const values = readValues(formData);
  const locale = String(formData.get("locale") ?? "");
  const startedAt = Number(formData.get("startedAt"));

  /** Bots: a filled honeypot or an instant submission gets the normal success screen, so they
   *  can't tell they were filtered, but nothing is sent to the API.
  **/
  const looksAutomated =
    String(formData.get("website") ?? "") !== "" ||
    !Number.isFinite(startedAt) ||
    Date.now() - startedAt < minimumFillMs;
  if (looksAutomated) return { status: "success", email: values.email };

  const fieldErrors = validate(values);
  if (Object.keys(fieldErrors).length > 0 || !isLocale(locale)) {
    return { status: "invalid", fieldErrors, values };
  }

  const clientIp = await getClientIp();
  const human = await verifyHumanToken(String(formData.get("turnstileToken") ?? ""), challengeAction, clientIp);
  if (!human) return { status: "error", error: "challenge", values };

  try {
    const result = await createAlphaSignup(
      {
        email: values.email,
        nickname: values.nickname,
        platforms: [...new Set(values.platforms)] as Platform[],
        recomps: values.recomps || null,
        locale,
        consent: values.consent,
      },
      clientIp,
    );

    if (result.ok) return { status: "success", email: values.email };
    if (result.status === 429) return { status: "error", error: "rateLimited", values };
    if (result.status === 400 && result.problem?.errors) {
      const apiErrors: Partial<Record<SignupField, SignupErrorCode>> = {};
      for (const key of Object.keys(result.problem.errors)) {
        const field = fieldFromApi(key);
        if (field) apiErrors[field] = apiErrorCode[field];
      }
      if (Object.keys(apiErrors).length > 0) return { status: "invalid", fieldErrors: apiErrors, values };
    }
  } catch (error) {
    console.error("Alpha sign-up failed", error);
  }

  return { status: "error", error: "unavailable", values };
}
