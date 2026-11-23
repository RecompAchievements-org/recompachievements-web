"use server";

import { refresh } from "next/cache";
import { isLocale } from "@/i18n/config";
import { deleteWallComment, getWallPage, postWallComment, type WallPage } from "@/lib/api/walls";
import { errorFrom, usernamePattern, type AuthError } from "@/lib/auth/forms";
import { visitor } from "@/lib/auth/session";

export type WallPostState = { status: "idle" | "posted" } | { status: "error"; error: AuthError };

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every rule (who may post or delete) is enforced by the API with the visitor's own session.
export async function postWallCommentAction(_previous: WallPostState, formData: FormData): Promise<WallPostState> {
  const username = String(formData.get("username") ?? "");
  const body = String(formData.get("body") ?? "").replace(/\r\n?/g, "\n").trim();
  if (!usernamePattern.test(username) || !body || body.length > 1000) return { status: "error", error: "invalid" };

  try {
    const result = await postWallComment(username, body, await visitor());
    if (!result.ok) return { status: "error", error: errorFrom(result) };
  } catch (error) {
    console.error("Posting a wall comment failed", error);
    return { status: "error", error: "unavailable" };
  }

  refresh();
  return { status: "posted" };
}

export async function deleteWallCommentAction(username: string, id: string): Promise<AuthError | null> {
  if (!usernamePattern.test(username) || !idPattern.test(id)) return "invalid";

  try {
    const result = await deleteWallComment(username, id, await visitor());
    if (!result.ok) return errorFrom(result);
  } catch (error) {
    console.error("Deleting a wall comment failed", error);
    return "unavailable";
  }

  refresh();
  return null;
}

export async function loadMoreWallComments(username: string, cursor: string, locale: string): Promise<WallPage | null> {
  if (!usernamePattern.test(username) || !idPattern.test(cursor) || !isLocale(locale)) return null;

  try {
    const result = await getWallPage(username, cursor, locale, await visitor());
    return result.ok ? result.data : null;
  } catch (error) {
    console.error("Loading wall comments failed", error);
    return null;
  }
}
