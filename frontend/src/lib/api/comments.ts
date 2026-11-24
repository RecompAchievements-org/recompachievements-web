import "server-only";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import type { PlayerAvatar } from "./accounts";
import { apiSend, type ApiResult, type VisitorContext } from "./client";

// Where comments live: a player's profile wall or a game page.
export type CommentThreadRef = { kind: "wall"; username: string } | { kind: "game"; slug: string };

interface ApiComment {
  id: string;
  authorUsername: string;
  authorJoinedAt: string;
  authorAvatar: PlayerAvatar | null;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

export interface SavedComment {
  id: string;
  authorUsername: string;
  authorAvatar: PlayerAvatar | null;
  body: string;
  // Already formatted on the server, so the page and the browser always show the same text.
  authorJoined: string;
  date: string;
  canDelete: boolean;
}

export interface CommentPage {
  comments: SavedComment[];
  nextCursor: string | null;
}

const dateOptions = { dateStyle: "medium", timeZone: "UTC" } as const;

const threadPath = (thread: CommentThreadRef) =>
  thread.kind === "wall"
    ? `/api/v1/users/${encodeURIComponent(thread.username)}/wall`
    : `/api/v1/games/${encodeURIComponent(thread.slug)}/comments`;

// One page for this visitor (who may delete what depends on them), so it's never cached.
export async function getCommentPage(
  thread: CommentThreadRef,
  before: string | null,
  locale: Locale,
  visitor: VisitorContext,
): Promise<ApiResult<CommentPage>> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const result = await apiSend<{ comments: ApiComment[]; nextCursor: string | null }>("GET", threadPath(thread) + query, undefined, visitor);
  if (!result.ok) return result;

  return {
    ...result,
    data: {
      nextCursor: result.data.nextCursor,
      comments: result.data.comments.map(({ createdAt, authorJoinedAt, ...comment }) => ({
        ...comment,
        authorJoined: formatDate(locale, new Date(authorJoinedAt), dateOptions),
        date: formatDate(locale, new Date(createdAt), dateOptions),
      })),
    },
  };
}

export const postComment = (thread: CommentThreadRef, body: string, visitor: VisitorContext) =>
  apiSend<ApiComment>("POST", threadPath(thread), { body }, visitor);

export const deleteComment = (thread: CommentThreadRef, id: string, visitor: VisitorContext) =>
  apiSend<void>("DELETE", `${threadPath(thread)}/${encodeURIComponent(id)}`, undefined, visitor);
