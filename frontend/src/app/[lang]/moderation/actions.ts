"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, localizePath } from "@/i18n/config";
import { runModeration, type ModerationOperation, type UserRole } from "@/lib/api/moderation";
import { errorFrom, usernamePattern, type AuthError } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

export type ModerationState =
  | { status: "idle" }
  | { status: "done"; cachePurged: boolean; heldWithoutEvidence: boolean }
  | { status: "error"; error: AuthError };

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles: readonly UserRole[] = ["player", "moderator", "admin"];

function readOperation(formData: FormData): ModerationOperation | null {
  const op = String(formData.get("op") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const username = String(formData.get("username") ?? "");
  const rawReport = String(formData.get("reportId") ?? "");
  const reportId = rawReport && idPattern.test(rawReport) ? rawReport : null;
  if (!reason || reason.length > 500 || (rawReport && !reportId)) return null;

  switch (op) {
    case "resolve":
    case "dismiss":
      return reportId ? { op, reportId, reason } : null;
    case "remove_comment": {
      const commentId = String(formData.get("commentId") ?? "");
      return idPattern.test(commentId) ? { op, commentId, reason, reportId } : null;
    }
    case "remove_photo":
    case "legal_hold":
    case "disable":
      return usernamePattern.test(username) ? { op, username, reason, reportId } : null;
    case "mute": {
      const days = Number(formData.get("days"));
      return usernamePattern.test(username) && Number.isInteger(days) && days >= 1 && days <= 365 ? { op, username, reason, days, reportId } : null;
    }
    case "unmute":
    case "enable":
      return usernamePattern.test(username) ? { op, username, reason } : null;
    case "role": {
      const role = String(formData.get("role") ?? "") as UserRole;
      return usernamePattern.test(username) && roles.includes(role) ? { op, username, reason, role } : null;
    }
    default:
      return null;
  }
}

// Who may do what is decided by the API, using the signed-in staff member's current role.
export async function moderationAction(_previous: ModerationState, formData: FormData): Promise<ModerationState> {
  const operation = readOperation(formData);
  if (!operation) return { status: "error", error: "invalid" };

  let state: ModerationState;
  try {
    const result = await runModeration(operation, await visitor());
    state = result.ok
      ? { status: "done", cachePurged: result.data.cachePurged, heldWithoutEvidence: result.data.status === "held_without_evidence" }
      : { status: "error", error: errorFrom(result) };
  } catch (error) {
    console.error("A moderation action failed", error);
    return { status: "error", error: "unavailable" };
  }

  if (state.status === "done") refresh();
  return state;
}

export async function findUserAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "");
  const locale = isLocale(raw) ? raw : "en";
  const username = String(formData.get("username") ?? "").trim();
  redirect(localizePath(locale, usernamePattern.test(username) ? `/moderation/users/${username}` : "/moderation"));
}
