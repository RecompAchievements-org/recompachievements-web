"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { ReportButton, type ReportLabels } from "@/components/moderation/ReportButton";
import { localizePath, type Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { CommentPage, CommentThreadRef } from "@/lib/api/comments";
import type { AuthError } from "@/lib/auth/forms";
import { deleteCommentAction, postCommentAction, type CommentPostState } from "./actions";
import type { CommentAuthorLabels } from "./CommentAuthor";
import { CommentPagination, commentPageHref } from "./CommentPagination";
import { CommentComposer, CommentThread } from "./CommentThread";

export interface SavedCommentsProps {
  thread: CommentThreadRef;
  // The section's own heading, intro, and placeholder (a wall's or a game page's).
  heading: string;
  intro: string;
  placeholder: string;
  locale: Locale;
  // The localized path of the page holding this section; page links add ?commentsPage=.
  basePath: string;
  page: CommentPage;
  // What this visitor can do: post, or what they need first.
  access: "post" | "signIn" | "email";
  messages: Messages["comments"];
  errors: Messages["auth"]["errors"];
  authorLabels: CommentAuthorLabels;
  viewerUsername: string | null;
  // Set while the signed-in viewer is muted; the API refuses their posts too.
  mutedNotice: string | null;
  reportLabels: ReportLabels;
}

/** Saved comments for any thread: walls and game pages. The server renders one numbered page; links
 *  move between pages, and the page refreshes after each post or delete.
**/
export function SavedComments({
  thread,
  heading,
  intro,
  placeholder,
  locale,
  basePath,
  page,
  access,
  messages,
  errors,
  authorLabels,
  viewerUsername,
  mutedNotice,
  reportLabels,
}: SavedCommentsProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<AuthError | null>(null);
  const [busy, startTransition] = useTransition();

  const [state, formAction, posting] = useActionState(async (previous: CommentPostState, formData: FormData) => {
    const result = await postCommentAction(previous, formData);
    if (result.status === "posted") {
      setDraft("");
      // A new comment is the newest, so it appears on page 1.
      if (page.page > 1) router.push(commentPageHref(basePath, 1));
    }
    return result;
  }, { status: "idle" } satisfies CommentPostState);

  const comments = page.comments.filter((comment) => !removed.includes(comment.id));

  const errorText = (error: AuthError) => (error === "invalid" ? messages.invalid : errors[error]);

  function remove(id: string) {
    setActionError(null);
    startTransition(async () => {
      const error = await deleteCommentAction(thread, id);
      setConfirming(null);
      if (error) {
        setActionError(error);
        return;
      }
      setRemoved((list) => [...list, id]);
    });
  }

  const linkClasses = "font-semibold text-accent underline hover:text-accent-strong";
  const composer =
    access === "post" ? (
      <CommentComposer
        action={formAction}
        error={state.status === "error" ? errorText(state.error) : null}
        label={messages.label}
        placeholder={placeholder}
        postLabel={posting ? messages.posting : messages.post}
        countTemplate={messages.count}
        draft={draft}
        onDraftChange={setDraft}
        pending={posting}
      >
        <input type="hidden" name="threadKind" value={thread.kind} />
        <input type="hidden" name="threadKey" value={thread.kind === "wall" ? thread.username : thread.slug} />
      </CommentComposer>
    ) : (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        {access === "signIn" ? (
          <Link href={localizePath(locale, "/sign-in")} className={linkClasses}>
            {messages.signInToComment}
          </Link>
        ) : (
          <>
            <span>{messages.emailToComment}</span>
            <Link href={localizePath(locale, "/account/settings")} className={linkClasses}>
              {messages.addEmail}
            </Link>
          </>
        )}
      </p>
    );

  const actionButton = "inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <CommentThread
      heading={heading}
      intro={intro}
      empty={messages.empty}
      locale={locale}
      authorLabels={authorLabels}
      composer={composer}
      blockedNotice={mutedNotice}
      comments={comments.map((comment) => ({
        id: comment.id,
        author: { username: comment.authorUsername, joined: comment.authorJoined, avatar: comment.authorAvatar },
        date: comment.date,
        body: comment.body,
        actions: (
          <>
            {viewerUsername && viewerUsername !== comment.authorUsername && (
              <ReportButton
                username={comment.authorUsername}
                targets={["comment"]}
                commentId={comment.id}
                labels={reportLabels}
                errors={errors}
                accessibleLabel={interpolate(messages.reportLabel, { username: comment.authorUsername })}
                className={`${actionButton} text-muted hover:bg-surface-raised hover:text-danger`}
              />
            )}
            {!comment.canDelete ? null : confirming === comment.id ? (
              <>
                <button type="button" disabled={busy} onClick={() => remove(comment.id)} className={`${actionButton} text-danger hover:bg-surface-raised`}>
                  {busy ? messages.deleting : messages.confirmDelete}
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={`${actionButton} text-muted hover:bg-surface-raised`}>
                  {messages.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label={interpolate(messages.deleteLabel, { username: comment.authorUsername })}
                onClick={() => setConfirming(comment.id)}
                className={`${actionButton} text-muted hover:bg-surface-raised hover:text-danger`}
              >
                {messages.delete}
              </button>
            )}
          </>
        ),
      }))}
      footer={
        <>
          {actionError && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-surface-raised p-3 text-sm text-danger">
              {errorText(actionError)}
            </p>
          )}
          <CommentPagination page={page.page} totalPages={page.totalPages} href={(number) => commentPageHref(basePath, number)} labels={messages.pagination} />
        </>
      }
    />
  );
}
