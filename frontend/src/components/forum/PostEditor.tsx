"use client";

import { useActionState, useId, useRef, useState } from "react";
import { deletePostAction, savePostAction, type ForumEditorState } from "@/app/[lang]/forum/actions";
import { FormMessage, inputClasses, SubmitButton } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import type { ForumPostSource } from "@/lib/api/forum";
import { cx } from "@/lib/cx";
import { Markdown } from "./Markdown";

type Language = "en" | "es" | "pt";
const languages: Language[] = ["en", "es", "pt"];

// A post address from its English title: lowercase words joined by hyphens, accents removed.
export function slugFromTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

// Writing and preview share one fixed height and scroll inside it, so long posts don't stretch the page.
const editorHeight = "h-80 sm:h-[28rem]";

const dangerClasses =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger px-5 py-2 text-center font-semibold text-on-accent transition-opacity hover:opacity-85";

/** The admin editor: English is required, Spanish and Portuguese are optional tabs. Write and
 *  Preview use the same Markdown renderer as the published post. A published post's address is
 *  locked, because links to it are shared.
**/
export function PostEditor({
  category,
  locale,
  source,
  messages,
  newTabLabel,
}: {
  category: string;
  locale: Locale;
  source: ForumPostSource | null;
  messages: Messages["forum"]["editor"];
  newTabLabel: string;
}) {
  const id = useId();
  const deleteRef = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(savePostAction, { status: "idle" } satisfies ForumEditorState);
  const [language, setLanguage] = useState<Language>("en");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState<Record<Language, string>>({
    en: source?.title.en ?? "",
    es: source?.title.es ?? "",
    pt: source?.title.pt ?? "",
  });
  const [body, setBody] = useState<Record<Language, string>>({
    en: source?.body.en ?? "",
    es: source?.body.es ?? "",
    pt: source?.body.pt ?? "",
  });
  const [slug, setSlug] = useState(source?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!source);
  const slugLocked = !!source?.publishedAt;
  const isPublished = source?.status === "published";

  const tab = (active: boolean) =>
    cx("inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors", active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground");

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="originalSlug" value={source?.slug ?? ""} />
        {languages.map((code) => (
          <span key={code} hidden>
            <input type="hidden" name={`title${code[0].toUpperCase()}${code[1]}`} value={title[code]} />
            <input type="hidden" name={`body${code[0].toUpperCase()}${code[1]}`} value={body[code]} />
          </span>
        ))}

        <div role="tablist" aria-label={messages.languages} className="flex flex-wrap gap-1 border-b border-border pb-2">
          {languages.map((code) => (
            <button key={code} type="button" role="tab" aria-selected={language === code} onClick={() => setLanguage(code)} className={tab(language === code)}>
              {messages.language[code]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-title`} className="text-sm font-semibold">
            {messages.titleLabel}
          </label>
          <input
            id={`${id}-title`}
            value={title[language]}
            maxLength={140}
            required={language === "en"}
            onChange={(event) => {
              const value = event.target.value;
              setTitle((current) => ({ ...current, [language]: value }));
              if (language === "en" && !slugEdited) setSlug(slugFromTitle(value));
            }}
            className={inputClasses}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{messages.bodyLabel}</span>
            <div className="flex gap-1">
              <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={tab(mode === "write")}>
                {messages.write}
              </button>
              <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")} className={tab(mode === "preview")}>
                {messages.preview}
              </button>
            </div>
          </div>
          {mode === "write" ? (
            <textarea
              aria-label={messages.bodyLabel}
              value={body[language]}
              maxLength={20000}
              rows={18}
              onChange={(event) => {
                const value = event.target.value;
                setBody((current) => ({ ...current, [language]: value }));
              }}
              className={cx(inputClasses, editorHeight, "resize-none overflow-y-auto font-mono text-sm leading-relaxed")}
            />
          ) : (
            <div className={cx(editorHeight, "overflow-y-auto rounded-lg border border-border bg-background p-4")}>
              {title[language].trim() && <p className="mb-4 font-display text-3xl font-bold text-foreground wrap-anywhere">{title[language]}</p>}
              {body[language].trim() ? (
                <Markdown source={body[language]} locale={locale} newTabLabel={newTabLabel} />
              ) : (
                <p className="text-subtle">{messages.previewEmpty}</p>
              )}
            </div>
          )}
          <p className="text-xs text-subtle">{messages.bodyHint}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-slug`} className="text-sm font-semibold">
            {messages.slugLabel}
          </label>
          {/** A disabled field isn't sent with the form, so a locked address travels in a hidden one. **/}
          {slugLocked && <input type="hidden" name="slug" value={slug} />}
          <input
            id={`${id}-slug`}
            name={slugLocked ? undefined : "slug"}
            value={slug}
            disabled={slugLocked}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            className={cx(inputClasses, "font-mono text-sm", slugLocked && "cursor-not-allowed border-border bg-surface text-muted hover:border-border")}
          />
          <p className="text-xs text-subtle">{slugLocked ? messages.slugLocked : messages.slugHint}</p>
        </div>

        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="pinned" defaultChecked={source?.pinned ?? false} className="mt-0.5 size-4 shrink-0 accent-accent" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{messages.pinLabel}</span>
            <span className="text-subtle">{messages.pinHint}</span>
          </span>
        </label>

        {state.status === "error" && <FormMessage message={messages.errors[state.error]} />}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <SaveButton intent="publish" label={isPublished ? messages.update : messages.publish} pendingLabel={messages.saving} />
          <SaveButton intent="draft" label={isPublished ? messages.unpublish : messages.saveDraft} pendingLabel={messages.saving} secondary />
          {source && (
            <button type="button" onClick={() => deleteRef.current?.showModal()} className={cx(dangerClasses, "sm:ml-auto")}>
              {messages.delete}
            </button>
          )}
        </div>
      </form>

      {source && (
        <dialog
          ref={deleteRef}
          aria-labelledby={`${id}-delete`}
          className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border-strong bg-surface p-5 text-foreground backdrop:bg-background/75"
        >
          <h2 id={`${id}-delete`} className="font-display text-xl font-semibold">
            {messages.deleteTitle}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{messages.deleteBody}</p>
          <form action={deletePostAction} className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="slug" value={source.slug} />
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={cx(dangerClasses, "flex-1")}>
              {messages.deleteConfirm}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => deleteRef.current?.close()}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-5 font-semibold transition-colors hover:border-accent"
            >
              {messages.cancel}
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}

// Submits the form with its intent, so one form can publish or save a draft.
function SaveButton({ intent, label, pendingLabel, secondary = false }: { intent: "publish" | "draft"; label: string; pendingLabel: string; secondary?: boolean }) {
  return <SubmitButton variant={secondary ? "secondary" : "primary"} label={label} pendingLabel={pendingLabel} name="intent" value={intent} className="w-full sm:w-auto" />;
}
