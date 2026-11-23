import "server-only";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { apiSend, type ApiResult, type VisitorContext } from "./client";

interface ApiWallComment {
  id: string;
  authorUsername: string;
  authorJoinedAt: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

export interface WallComment {
  id: string;
  authorUsername: string;
  body: string;
  // Already formatted on the server, so the page and the browser always show the same text.
  authorJoined: string;
  date: string;
  canDelete: boolean;
}

export interface WallPage {
  comments: WallComment[];
  nextCursor: string | null;
}

const dateOptions = { dateStyle: "medium", timeZone: "UTC" } as const;

const wallPath = (username: string) => `/api/v1/users/${encodeURIComponent(username)}/wall`;

// One page for this visitor (who may delete what depends on them), so it's never cached.
export async function getWallPage(
  username: string,
  before: string | null,
  locale: Locale,
  visitor: VisitorContext,
): Promise<ApiResult<WallPage>> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  const result = await apiSend<{ comments: ApiWallComment[]; nextCursor: string | null }>("GET", wallPath(username) + query, undefined, visitor);
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

export const postWallComment = (username: string, body: string, visitor: VisitorContext) =>
  apiSend<ApiWallComment>("POST", wallPath(username), { body }, visitor);

export const deleteWallComment = (username: string, id: string, visitor: VisitorContext) =>
  apiSend<void>("DELETE", `${wallPath(username)}/${encodeURIComponent(id)}`, undefined, visitor);
