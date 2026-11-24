"use server";

import { refresh } from "next/cache";
import { badgeDetailsData } from "@/components/profile/badgeDetailsData";
import type { PlayerPreviewData } from "@/components/profile/PlayerPreview";
import { photoSampleBadges } from "@/components/profile/sampleBadges";
import { isLocale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { loadMessages } from "@/i18n/server";
import { getPublicPlayer } from "@/lib/api/accounts";
import { deleteComment, getCommentPage, postComment, type CommentPage, type CommentThreadRef } from "@/lib/api/comments";
import { errorFrom, usernamePattern, type AuthError } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

// Only public player fields, loaded when a comment author's preview first opens.
export async function loadPlayerPreview(username: string, locale: string): Promise<PlayerPreviewData | null> {
  if (!usernamePattern.test(username) || !isLocale(locale)) return null;

  try {
    const result = await getPublicPlayer(username, await visitor());
    if (!result.ok) return null;
    const format = (value: string) => formatDate(locale, new Date(value), { dateStyle: "medium", timeZone: "UTC" });
    const messages = await loadMessages(locale);
    return {
      username: result.data.username,
      memberSince: format(result.data.createdAt),
      lastActive: format(result.data.lastActiveOn),
      avatar: result.data.avatar,
      // Sample data, labeled in the preview, until players can choose real featured badges.
      badges: photoSampleBadges.map((badge) => {
        const { kind, rarity, name, rarityLabel } = badgeDetailsData(badge, result.data, locale, messages);
        return { id: badge.id, kind, rarity, name, rarityLabel };
      }),
    };
  } catch (error) {
    console.error("Loading a player preview failed", error);
    return null;
  }
}

export type CommentPostState = { status: "idle" | "posted" } | { status: "error"; error: AuthError };

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9-]{1,64}$/;
const maxCommentLength = 1000;

// The thread comes from the browser, so it's checked here before it becomes an API path.
function validThread(thread: CommentThreadRef): boolean {
  return thread.kind === "wall" ? usernamePattern.test(thread.username) : thread.kind === "game" && slugPattern.test(thread.slug);
}

function threadFrom(formData: FormData): CommentThreadRef | null {
  const key = String(formData.get("threadKey") ?? "");
  const kind = formData.get("threadKind");
  const thread: CommentThreadRef | null = kind === "wall" ? { kind, username: key } : kind === "game" ? { kind, slug: key } : null;
  return thread && validThread(thread) ? thread : null;
}

// Every rule (who may post or delete) is enforced by the API with the visitor's own session.
export async function postCommentAction(_previous: CommentPostState, formData: FormData): Promise<CommentPostState> {
  const thread = threadFrom(formData);
  const body = String(formData.get("body") ?? "").replace(/\r\n?/g, "\n").trim();
  if (!thread || !body || body.length > maxCommentLength) return { status: "error", error: "invalid" };

  try {
    const result = await postComment(thread, body, await visitor());
    if (!result.ok) return { status: "error", error: errorFrom(result) };
  } catch (error) {
    console.error("Posting a comment failed", error);
    return { status: "error", error: "unavailable" };
  }

  refresh();
  return { status: "posted" };
}

export async function deleteCommentAction(thread: CommentThreadRef, id: string): Promise<AuthError | null> {
  if (!validThread(thread) || !idPattern.test(id)) return "invalid";

  try {
    const result = await deleteComment(thread, id, await visitor());
    if (!result.ok) return errorFrom(result);
  } catch (error) {
    console.error("Deleting a comment failed", error);
    return "unavailable";
  }

  refresh();
  return null;
}

export async function loadMoreComments(thread: CommentThreadRef, cursor: string, locale: string): Promise<CommentPage | null> {
  if (!validThread(thread) || !idPattern.test(cursor) || !isLocale(locale)) return null;

  try {
    const result = await getCommentPage(thread, cursor, locale, await visitor());
    return result.ok ? result.data : null;
  } catch (error) {
    console.error("Loading comments failed", error);
    return null;
  }
}
