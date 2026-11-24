import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/config";
import type { PlayerAvatar } from "./accounts";
import { apiGet, apiSend, type ApiResult, type VisitorContext } from "./client";

export const forumTag = "forum";

export interface ForumPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published";
  pinned: boolean;
  authorUsername: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ForumCategory {
  key: string;
  name: string;
  description: string;
  adminOnly: boolean;
  commentsEnabled: boolean;
  postCount: number;
  // Every pinned post, newest pin first, and the five most recently published posts.
  pinnedPosts: ForumPostSummary[];
  recentPosts: ForumPostSummary[];
}

export interface ForumPostPage {
  category: ForumCategory;
  posts: ForumPostSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ForumPost {
  categoryKey: string;
  categoryName: string;
  commentsEnabled: boolean;
  slug: string;
  title: string;
  body: string;
  excerpt: string;
  languages: Locale[];
  status: "draft" | "published";
  authorUsername: string | null;
  authorAvatar: PlayerAvatar | null;
  createdAt: string;
  publishedAt: string | null;
  editedAt: string | null;
}

export interface ForumText {
  en: string;
  es: string | null;
  pt: string | null;
}

export interface ForumPostSource {
  slug: string;
  title: ForumText;
  body: ForumText;
  status: "draft" | "published";
  pinned: boolean;
  publishedAt: string | null;
}

const segment = encodeURIComponent;

/** Published forum content is the same for every visitor, so it's cached and tagged; admin changes
 *  call updateTag(forumTag) so readers see them at once. Failures throw and are not cached.
**/
export async function getForumCategories(locale: Locale): Promise<ForumCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(forumTag);

  const result = await apiGet<ForumCategory[]>(`/api/v1/forum/categories?lang=${locale}`);
  if (!result.ok) throw new Error(`Loading forum categories failed with status ${result.status}.`);
  return result.data;
}

// Returns null for an unknown category.
export async function getForumPosts(category: string, page: number, locale: Locale): Promise<ForumPostPage | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(forumTag);

  const result = await apiGet<ForumPostPage>(`/api/v1/forum/${segment(category)}/posts?page=${page}&lang=${locale}`);
  if (result.ok) return result.data;
  if (result.status === 404) return null;
  throw new Error(`Loading forum posts failed with status ${result.status}.`);
}

// Returns null for an unknown or unpublished post.
export async function getForumPost(category: string, slug: string, locale: Locale): Promise<ForumPost | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(forumTag);

  const result = await apiGet<ForumPost>(`/api/v1/forum/${segment(category)}/posts/${segment(slug)}?lang=${locale}`);
  if (result.ok) return result.data;
  if (result.status === 404) return null;
  throw new Error(`Loading forum post "${slug}" failed with status ${result.status}.`);
}

const adminBase = (category: string) => `/api/v1/forum-admin/${segment(category)}/posts`;

// Admin calls carry the admin's session and are never cached.
export const getAdminForumPosts = (category: string, page: number, locale: Locale, visitor: VisitorContext) =>
  apiSend<ForumPostPage>("GET", `${adminBase(category)}?page=${page}&lang=${locale}`, undefined, visitor);

export const getForumPostSource = (category: string, slug: string, visitor: VisitorContext) =>
  apiSend<ForumPostSource>("GET", `${adminBase(category)}/${segment(slug)}`, undefined, visitor);

export interface SaveForumPost {
  slug: string;
  title: ForumText;
  body: ForumText;
  status: "draft" | "published";
  pinned: boolean;
}

export const createForumPost = (category: string, post: SaveForumPost, visitor: VisitorContext): Promise<ApiResult<ForumPostSource>> =>
  apiSend<ForumPostSource>("POST", adminBase(category), post, visitor);

export const updateForumPost = (category: string, slug: string, post: SaveForumPost, visitor: VisitorContext) =>
  apiSend<ForumPostSource>("PUT", `${adminBase(category)}/${segment(slug)}`, post, visitor);

export const deleteForumPost = (category: string, slug: string, visitor: VisitorContext) =>
  apiSend<void>("DELETE", `${adminBase(category)}/${segment(slug)}`, undefined, visitor);
