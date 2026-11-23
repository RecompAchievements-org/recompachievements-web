"use client";

import { useState } from "react";
import type { CommentAuthorInfo, CommentAuthorLabels } from "@/components/comments/CommentAuthor";
import { CommentComposer, CommentThread } from "@/components/comments/CommentThread";
import type { Locale } from "@/i18n/config";

export interface CommentsLabels {
  heading: string;
  intro: string;
  accountsNotice: string;
  label: string;
  placeholder: string;
  post: string;
  empty: string;
  you: string;
  justNow: string;
  notSaved: string;
  count: string;
  author: CommentAuthorLabels;
}

/** Visual preview of game comments until saved comments are built: the form works, but a posted
 *  comment only lives in this page's state. Nothing is sent to the API or stored, and a reload
 *  clears it.
 *  Replace with real, account-backed comments when that feature lands.
**/
export function CommentsPreview({ labels, locale, viewer }: { labels: CommentsLabels; locale: Locale; viewer: Extract<CommentAuthorInfo, { username: string }> | null }) {
  const [draft, setDraft] = useState("");
  const [posted, setPosted] = useState<{ id: number; text: string }[]>([]);

  return (
    <CommentThread
      heading={labels.heading}
      intro={labels.intro}
      empty={labels.empty}
      locale={locale}
      authorLabels={labels.author}
      comments={posted.map((comment) => ({
        id: comment.id,
        author: viewer ?? { name: labels.you },
        date: labels.justNow,
        badge: labels.notSaved,
        body: comment.text,
      }))}
      composer={
        <CommentComposer
          notice={labels.accountsNotice}
          label={labels.label}
          placeholder={labels.placeholder}
          postLabel={labels.post}
          countTemplate={labels.count}
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setPosted((list) => [{ id: Date.now(), text }, ...list]);
            setDraft("");
          }}
        />
      }
    />
  );
}
