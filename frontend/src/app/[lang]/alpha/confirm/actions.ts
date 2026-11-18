"use server";

import { confirmAlphaSignup } from "@/lib/api/alphaSignups";
import { getClientIp } from "@/lib/clientIp";

export type ConfirmState = { status: "idle" | "confirmed" | "expired" | "invalid" | "unavailable" };

/** Confirmation happens on a button press (POST), not on opening the link, so email scanners that
 *  pre-open links can't confirm on someone's behalf.
**/
export async function confirmSignup(_previous: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { status: "invalid" };

  try {
    const result = await confirmAlphaSignup(token, await getClientIp());
    if (result.ok) return { status: "confirmed" };
    if (result.status === 410) return { status: "expired" };
    if (result.status === 404 || result.status === 400) return { status: "invalid" };
  } catch (error) {
    console.error("Alpha sign-up confirmation failed", error);
  }
  return { status: "unavailable" };
}
