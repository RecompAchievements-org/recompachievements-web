"use client";

import { useId, useState } from "react";

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
}

const maxLength = 1000;

/** Visual preview of game comments until accounts exist: the form works, but a posted comment
 *  only lives in this page's state. Nothing is sent to the API or stored, and a reload clears it.
 *  Replace with real, account-backed comments when that feature lands.
**/
export function CommentsPreview({ labels }: { labels: CommentsLabels }) {
  const [draft, setDraft] = useState("");
  const [posted, setPosted] = useState<{ id: number; text: string }[]>([]);
  const fieldId = useId();
  const counterId = useId();
  const text = draft.trim();

  return (
    <section aria-labelledby={`${fieldId}-heading`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id={`${fieldId}-heading`} className="font-display text-2xl font-semibold">
          {labels.heading}
        </h2>
        <p className="text-muted">{labels.intro}</p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text) return;
          setPosted((list) => [{ id: Date.now(), text }, ...list]);
          setDraft("");
        }}
      >
        <p className="text-sm leading-relaxed text-subtle">{labels.accountsNotice}</p>
        <label htmlFor={fieldId} className="text-sm font-semibold">
          {labels.label}
        </label>
        <textarea
          id={fieldId}
          value={draft}
          maxLength={maxLength}
          rows={3}
          placeholder={labels.placeholder}
          aria-describedby={counterId}
          onChange={(event) => setDraft(event.target.value)}
          className="h-28 resize-none overflow-y-auto rounded-lg border border-border bg-surface-raised px-3 py-2 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span id={counterId} className="font-mono text-xs text-subtle">
            {labels.count.replace("{count}", String(draft.length)).replace("{max}", String(maxLength))}
          </span>
          {/** Plain button styled like Button (sm): the ui/Button module also exports server-only links. **/}
          <button
            type="submit"
            disabled={!text}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:pointer-events-none disabled:opacity-50"
          >
            {labels.post}
          </button>
        </div>
      </form>

      <ul aria-live="polite" className="flex flex-col gap-3">
        {posted.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
            {labels.empty}
          </li>
        ) : (
          posted.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{labels.you}</span>
                <span className="text-subtle">· {labels.justNow}</span>
                <span className="rounded-md border border-border-strong px-1.5 py-0.5 text-xs text-muted">
                  {labels.notSaved}
                </span>
              </div>
              <p className="leading-relaxed whitespace-pre-line text-muted">{comment.text}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
