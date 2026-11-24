"use server";

import { createReport, reportReasons, type ReportReason, type ReportTarget } from "@/lib/api/moderation";
import { errorFrom, usernamePattern, type AuthError } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

export type ReportState = { status: "idle" | "sent" } | { status: "error"; error: AuthError };

const targets: readonly ReportTarget[] = ["profile", "photo", "wall_comment"];
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitReport(_previous: ReportState, formData: FormData): Promise<ReportState> {
  const targetType = String(formData.get("targetType") ?? "") as ReportTarget;
  const targetUsername = String(formData.get("targetUsername") ?? "");
  const commentId = String(formData.get("commentId") ?? "") || null;
  const reason = String(formData.get("reason") ?? "") as ReportReason;
  const details = String(formData.get("details") ?? "").trim() || null;

  const validComment = targetType === "wall_comment" ? !!commentId && idPattern.test(commentId) : commentId === null;
  if (!targets.includes(targetType) || !usernamePattern.test(targetUsername) || !validComment || !reportReasons.includes(reason) || (details?.length ?? 0) > 500) {
    return { status: "error", error: "invalid" };
  }

  try {
    const result = await createReport({ targetType, targetUsername, commentId, reason, details }, await visitor());
    return result.ok ? { status: "sent" } : { status: "error", error: errorFrom(result) };
  } catch (error) {
    console.error("Sending a report failed", error);
    return { status: "error", error: "unavailable" };
  }
}
