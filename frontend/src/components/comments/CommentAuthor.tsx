"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PlayerPreview, type PlayerPreviewData, type PlayerPreviewLabels } from "@/components/profile/PlayerPreview";
import { ProfilePhoto } from "@/components/profile/ProfilePhoto";
import { localizePath, type Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { loadPlayerPreview } from "./actions";

// A real player, or a label for a visitor without an account (no profile to link to).
export type CommentAuthorInfo = { username: string; joined: string } | { name: string };

export type CommentAuthorLabels = PlayerPreviewLabels & { joined: string };

const columnClasses =
  "flex min-w-0 items-center gap-3 border-b border-border pb-3 sm:w-48 sm:shrink-0 sm:flex-col sm:gap-2 sm:border-r sm:border-b-0 sm:pr-4 sm:pb-0 sm:text-center";
const photoClasses = "block size-12 shrink-0 overflow-hidden rounded-lg sm:size-16";

/** Loads each player's preview once per comment section, however many comments they wrote.
 *  Requests in progress are shared too; a failed load is forgotten so it can be tried again.
**/
export function usePlayerPreviews(locale: Locale) {
  const [previews] = useState(() => new Map<string, Promise<PlayerPreviewData | null>>());

  return useCallback(
    (username: string) => {
      const key = `${locale}:${username}`;
      const saved = previews.get(key);
      if (saved) return saved;

      const request = loadPlayerPreview(username, locale)
        .catch(() => null)
        .then((data) => {
          if (!data) previews.delete(key);
          return data;
        });
      previews.set(key, request);
      return request;
    },
    [locale, previews],
  );
}

// The author column every comment shows: photo with profile preview, username, and join date.
export function CommentAuthor({
  author,
  locale,
  labels,
  load,
}: {
  author: CommentAuthorInfo;
  locale: Locale;
  labels: CommentAuthorLabels;
  load: (username: string) => Promise<PlayerPreviewData | null>;
}) {
  if ("name" in author) {
    return (
      <div className={columnClasses}>
        <ProfilePhoto className={photoClasses} />
        <span className="min-w-0 text-sm font-semibold wrap-anywhere">{author.name}</span>
      </div>
    );
  }

  const href = localizePath(locale, `/account/${author.username}`);
  return (
    <div className={columnClasses}>
      <PlayerPreview
        username={author.username}
        href={href}
        labels={{ ...labels, open: interpolate(labels.open, { username: author.username }) }}
        load={load}
        className={`${photoClasses} transition-opacity hover:opacity-80`}
      />
      <div className="flex min-w-0 flex-col">
        <Link href={href} className="text-sm font-semibold wrap-anywhere hover:text-accent">
          {author.username}
        </Link>
        <span className="text-xs text-subtle">{interpolate(labels.joined, { date: author.joined })}</span>
      </div>
    </div>
  );
}
