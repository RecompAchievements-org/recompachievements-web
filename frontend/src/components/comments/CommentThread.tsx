"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { CommentAuthor, usePlayerPreviews, type CommentAuthorInfo, type CommentAuthorLabels } from "./CommentAuthor";

export const commentMaxLength = 1000;

export interface ThreadComment {
  id: string | number;
  author: CommentAuthorInfo;
  date: string;
  badge?: string;
  body: string;
  actions?: ReactNode;
}

/** The comment section every page uses: a heading, an optional composer slot, the list, and an
 *  optional footer. Each comment always shows its author column. It only displays; its parent owns
 *  the data. Text is always rendered as plain text.
**/
export function CommentThread({
  heading,
  intro,
  composer,
  blockedNotice,
  comments,
  empty,
  footer,
  locale,
  authorLabels,
}: {
  heading: string;
  intro: string;
  composer?: ReactNode;
  // Replaces the composer when this visitor can't post, such as a muted player.
  blockedNotice?: string | null;
  comments: ThreadComment[];
  empty: string;
  footer?: ReactNode;
  locale: Locale;
  authorLabels: CommentAuthorLabels;
}) {
  const headingId = useId();
  const loadPreview = usePlayerPreviews(locale);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id={headingId} className="font-display text-2xl font-semibold wrap-anywhere">
          {heading}
        </h2>
        <p className="text-muted">{intro}</p>
      </div>

      {blockedNotice ? (
        <p role="status" className="rounded-2xl border border-gold/40 bg-surface p-5 text-sm text-gold">
          {blockedNotice}
        </p>
      ) : (
        composer
      )}

      <ul aria-live="polite" className="flex flex-col gap-3">
        {comments.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">{empty}</li>
        ) : (
          comments.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:gap-4">
              <CommentAuthor author={comment.author} locale={locale} labels={authorLabels} load={loadPreview} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-subtle">{comment.date}</span>
                  {comment.badge && (
                    <span className="rounded-md border border-border-strong px-1.5 py-0.5 text-xs text-muted">{comment.badge}</span>
                  )}
                  {comment.actions && <span className="ml-auto flex items-center gap-1">{comment.actions}</span>}
                </div>
                <p className="leading-relaxed wrap-anywhere whitespace-pre-line text-muted">{comment.body}</p>
              </div>
            </li>
          ))
        )}
      </ul>

      {footer}
    </section>
  );
}

// The comment form: pass onSubmit for browser-only state, or action for a Server Action.
export function CommentComposer({
  notice,
  error,
  label,
  placeholder,
  postLabel,
  countTemplate,
  draft,
  onDraftChange,
  pending = false,
  children,
  ...form
}: {
  notice?: string;
  error?: string | null;
  label: string;
  placeholder: string;
  postLabel: string;
  countTemplate: string;
  draft: string;
  onDraftChange: (value: string) => void;
  pending?: boolean;
  children?: ReactNode;
} & Pick<ComponentProps<"form">, "action" | "onSubmit">) {
  const fieldId = useId();
  const counterId = useId();

  return (
    <form {...form} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      {children}
      {notice && <p className="text-sm leading-relaxed text-subtle">{notice}</p>}
      {error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-surface-raised p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={fieldId}
        name="body"
        value={draft}
        maxLength={commentMaxLength}
        rows={3}
        placeholder={placeholder}
        aria-describedby={counterId}
        onChange={(event) => onDraftChange(event.target.value)}
        className="h-28 resize-none overflow-y-auto rounded-lg border border-border bg-surface-raised px-3 py-2 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span id={counterId} className="font-mono text-xs text-subtle">
          {countTemplate.replace("{count}", String(draft.length)).replace("{max}", String(commentMaxLength))}
        </span>
        {/** Plain button styled like Button (sm): the ui/Button module also exports server-only links. **/}
        <button
          type="submit"
          disabled={!draft.trim() || pending}
          className="inline-flex min-h-8 items-center justify-center rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50"
        >
          {postLabel}
        </button>
      </div>
    </form>
  );
}
