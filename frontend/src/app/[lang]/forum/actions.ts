"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale, localizePath } from "@/i18n/config";
import { createForumPost, deleteForumPost, forumTag, updateForumPost, type SaveForumPost } from "@/lib/api/forum";
import { visitor } from "@/lib/auth/session";

export type ForumEditorError = "invalid" | "slug_taken" | "slug_locked" | "rateLimited" | "unavailable";
export type ForumEditorState = { status: "idle" } | { status: "error"; error: ForumEditorError };

const keyPattern = /^[a-z0-9-]{1,32}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const optional = (value: string) => (value.trim() ? value : null);

// Who may write is decided by the API with the admin's own session; this only shapes the request.
export async function savePostAction(_previous: ForumEditorState, formData: FormData): Promise<ForumEditorState> {
  const rawLocale = text(formData, "locale");
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const category = text(formData, "category");
  const originalSlug = text(formData, "originalSlug");
  const status = formData.get("intent") === "publish" ? "published" : "draft";
  const post: SaveForumPost = {
    slug: text(formData, "slug").trim(),
    title: { en: text(formData, "titleEn"), es: optional(text(formData, "titleEs")), pt: optional(text(formData, "titlePt")) },
    body: { en: text(formData, "bodyEn"), es: optional(text(formData, "bodyEs")), pt: optional(text(formData, "bodyPt")) },
    status,
    pinned: formData.get("pinned") === "on",
  };

  if (!keyPattern.test(category) || !slugPattern.test(post.slug) || !post.title.en.trim() || !post.body.en.trim()) {
    return { status: "error", error: "invalid" };
  }

  try {
    const result = originalSlug
      ? await updateForumPost(category, originalSlug, post, await visitor())
      : await createForumPost(category, post, await visitor());
    if (!result.ok) {
      const code = result.problem?.code;
      if (code === "slug_taken" || code === "slug_locked") return { status: "error", error: code };
      if (result.status === 429) return { status: "error", error: "rateLimited" };
      return { status: "error", error: result.status === 400 ? "invalid" : "unavailable" };
    }
  } catch (error) {
    console.error("Saving a forum post failed", error);
    return { status: "error", error: "unavailable" };
  }

  updateTag(forumTag);
  redirect(localizePath(locale, status === "published" ? `/forum/${category}/${post.slug}` : `/forum/${category}/${post.slug}/edit`));
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const rawLocale = text(formData, "locale");
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const category = text(formData, "category");
  const slug = text(formData, "slug");
  if (!keyPattern.test(category) || !slugPattern.test(slug)) redirect(localizePath(locale, "/forum"));

  try {
    await deleteForumPost(category, slug, await visitor());
  } catch (error) {
    console.error("Deleting a forum post failed", error);
  }

  updateTag(forumTag);
  redirect(localizePath(locale, `/forum/${category}`));
}
