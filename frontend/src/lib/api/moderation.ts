import "server-only";
import { apiSend, type VisitorContext } from "./client";
import type { PlayerAvatar } from "./accounts";

export const reportReasons = ["sexual", "violence", "hate", "harassment", "copyright", "personal_info", "spam", "other"] as const;
export type ReportReason = (typeof reportReasons)[number];
export type ReportTarget = "profile" | "photo" | "comment";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type UserRole = "player" | "moderator" | "admin";

export interface ReportSummary {
  id: string;
  targetType: ReportTarget;
  reason: ReportReason;
  status: ReportStatus;
  reporterUsername: string | null;
  reportedUsername: string | null;
  details: string | null;
  createdAt: string;
}

export interface ModerationLogEntry {
  id: string;
  moderatorUsername: string | null;
  targetUsername: string | null;
  action: string;
  reason: string;
  evidence: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ModerationUser {
  username: string;
  role: UserRole;
  isEnabled: boolean;
  isMuted: boolean;
  mutedUntil: string | null;
  createdAt: string;
  lastActivityAt: string;
  avatar: PlayerAvatar | null;
  openReports: number;
  recentActions: ModerationLogEntry[];
}

export interface ReportDetail {
  report: ReportSummary;
  targetKey: string;
  snapshot: string | null;
  targetStillExists: boolean;
  resolvedByUsername: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  // Where a reported comment is shown, while it still exists.
  commentLocation: { kind: "wall" | "game"; key: string; page: number } | null;
  reportedUser: ModerationUser | null;
}

export interface ModerationResult {
  status: string;
  cachePurged: boolean;
}

const base = "/api/v1/moderation";
const name = encodeURIComponent;

export const createReport = (
  input: { targetType: ReportTarget; targetUsername: string; commentId: string | null; reason: ReportReason; details: string | null },
  visitor: VisitorContext,
) => apiSend<{ status: string }>("POST", "/api/v1/reports", input, visitor);

export function getReports(status: ReportStatus, before: string | null, visitor: VisitorContext) {
  const cursor = before ? `&before=${name(before)}` : "";
  return apiSend<{ reports: ReportSummary[]; nextCursor: string | null }>("GET", `${base}/reports?status=${status}${cursor}`, undefined, visitor);
}

export const getReport = (id: string, visitor: VisitorContext) => apiSend<ReportDetail>("GET", `${base}/reports/${name(id)}`, undefined, visitor);

export const getModerationUser = (username: string, visitor: VisitorContext) =>
  apiSend<ModerationUser>("GET", `${base}/users/${name(username)}`, undefined, visitor);

export const getModerationLog = (before: string | null, visitor: VisitorContext) =>
  apiSend<{ actions: ModerationLogEntry[]; nextCursor: string | null }>("GET", `${base}/log${before ? `?before=${name(before)}` : ""}`, undefined, visitor);

export type ModerationOperation =
  | { op: "resolve" | "dismiss"; reportId: string; reason: string }
  | { op: "remove_comment"; commentId: string; reason: string; reportId: string | null }
  | { op: "remove_photo" | "legal_hold" | "disable"; username: string; reason: string; reportId: string | null }
  | { op: "mute"; username: string; reason: string; days: number; reportId: string | null }
  | { op: "unmute" | "enable"; username: string; reason: string }
  | { op: "role"; username: string; reason: string; role: UserRole };

export function runModeration(operation: ModerationOperation, visitor: VisitorContext) {
  const send = (method: "POST" | "PUT", path: string, body: unknown) => apiSend<ModerationResult>(method, `${base}${path}`, body, visitor);
  switch (operation.op) {
    case "resolve":
    case "dismiss":
      return send("POST", `/reports/${name(operation.reportId)}/${operation.op}`, { reason: operation.reason });
    case "remove_comment":
      return send("POST", `/comments/${name(operation.commentId)}/remove`, { reason: operation.reason, reportId: operation.reportId });
    case "remove_photo":
      return send("POST", `/users/${name(operation.username)}/photo/remove`, { reason: operation.reason, reportId: operation.reportId });
    case "legal_hold":
      return send("POST", `/users/${name(operation.username)}/photo/legal-hold`, { reason: operation.reason, reportId: operation.reportId });
    case "disable":
      return send("POST", `/users/${name(operation.username)}/disable`, { reason: operation.reason, reportId: operation.reportId });
    case "mute":
      return send("POST", `/users/${name(operation.username)}/mute`, { reason: operation.reason, days: operation.days, reportId: operation.reportId });
    case "unmute":
    case "enable":
      return send("POST", `/users/${name(operation.username)}/${operation.op}`, { reason: operation.reason });
    case "role":
      return send("PUT", `/users/${name(operation.username)}/role`, { role: operation.role, reason: operation.reason });
  }
}
