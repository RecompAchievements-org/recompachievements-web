"use server";

import { confirmEmail } from "@/lib/api/accounts";
import { getClientIp } from "@/lib/clientIp";

export type ConfirmEmailState = { status: "idle" | "confirmed" | "expired" | "invalid" | "inUse" | "unavailable" };

/** Confirms on a button press (POST), not on opening the link, so email scanners that pre-open
 *  links can't confirm on someone's behalf.
**/
export async function confirmEmailAction(_previous: ConfirmEmailState, formData: FormData): Promise<ConfirmEmailState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { status: "invalid" };

  try {
    const result = await confirmEmail(token, { clientIp: await getClientIp() });
    if (result.ok) return { status: "confirmed" };
    if (result.status === 410) return { status: "expired" };
    if (result.status === 409) return { status: "inUse" };
    if (result.status === 404 || result.status === 400) return { status: "invalid" };
  } catch (error) {
    console.error("Email confirmation failed", error);
  }
  return { status: "unavailable" };
}
