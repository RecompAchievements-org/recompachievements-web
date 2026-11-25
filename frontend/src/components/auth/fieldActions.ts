"use server";

import { isUsernameAvailable } from "@/lib/api/accounts";
import { usernamePattern } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

export type UsernameCheck = "available" | "taken" | "reserved" | "unknown";

// Whether a well-formed username can still be chosen, or is reserved for good; "unknown" when the API can't say right now.
export async function checkUsernameAvailability(username: string): Promise<UsernameCheck> {
  if (!usernamePattern.test(username)) return "unknown";
  try {
    const result = await isUsernameAvailable(username, await visitor());
    if (!result.ok) return "unknown";
    return result.data.available ? "available" : result.data.reserved ? "reserved" : "taken";
  } catch (error) {
    console.error("Checking a username failed", error);
    return "unknown";
  }
}
