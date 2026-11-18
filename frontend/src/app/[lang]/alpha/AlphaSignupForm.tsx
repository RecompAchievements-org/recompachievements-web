"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import type { Messages } from "@/i18n/server";
import { cx } from "@/lib/cx";
import { signUpForAlpha, type SignupField, type SignupState } from "./actions";

const platformOptions = [
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "macos", label: "macOS" },
  { value: "steam_deck", label: "Steam Deck" },
] as const;

const inputClasses =
  "w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-foreground placeholder:text-subtle transition-colors hover:border-muted aria-[invalid=true]:border-danger";

interface AlphaSignupFormProps {
  locale: Locale;
  privacyHref: string;
  messages: Messages["alpha"];
}

export function AlphaSignupForm({ locale, privacyHref, messages }: AlphaSignupFormProps) {
  const [state, formAction] = useActionState(signUpForAlpha, { status: "idle" } satisfies SignupState);
  const openedAt = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const { form, errors } = messages;

  // Records when the visitor opened the page; scripts that post instantly are filtered server-side.
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  // After a failed submit, move focus to the first invalid field (or the error message).
  useEffect(() => {
    if (state.status === "invalid") {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    } else if (state.status === "error") {
      statusRef.current?.focus();
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <Card role="status" className="flex flex-col gap-3 border-success/40">
        <h2 className="font-display text-2xl font-bold">{messages.success.title}</h2>
        <p>
          {rich(messages.success.body, {
            email: <strong className="break-all text-foreground">{state.email}</strong>,
          })}
        </p>
        <p className="text-sm text-muted">{messages.success.spam}</p>
      </Card>
    );
  }

  const values = state.status === "invalid" || state.status === "error" ? state.values : null;
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const errorFor = (field: SignupField) => {
    const code = fieldErrors[field];
    return code ? errors[code] : null;
  };
  const consentLabel = rich(form.consent, {
    privacy: (
      <a href={privacyHref} className="text-accent underline hover:text-accent-strong">
        {messages.privacyLink}
      </a>
    ),
  });

  return (
    // The key remounts the form after each attempt so the visitor's answers are shown again.
    <form
      ref={formRef}
      key={JSON.stringify(state)}
      action={formAction}
      onSubmit={(event) => {
        const field = event.currentTarget.elements.namedItem("startedAt");
        if (field instanceof HTMLInputElement) field.value = String(openedAt.current);
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" defaultValue="" />

      {/** Honeypot: invisible to people (and skipped by keyboard and screen readers); bots tend
       *  to fill every field.
      **/}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          {form.honeypot}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p
        ref={statusRef}
        tabIndex={-1}
        aria-live="polite"
        className={cx("text-sm", state.status === "idle" ? "sr-only" : "rounded-lg border border-danger/40 bg-surface-raised p-3 text-danger")}
      >
        {state.status === "error" ? errors[state.error] : state.status === "invalid" ? errors.invalid : ""}
      </p>

      <Field id="email" label={form.email} error={errorFor("email")}>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          placeholder={form.emailPlaceholder}
          defaultValue={values?.email}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={inputClasses}
        />
      </Field>

      <Field id="nickname" label={form.nickname} hint={form.nicknameHint} error={errorFor("nickname")}>
        <input
          id="nickname"
          name="nickname"
          type="text"
          required
          minLength={2}
          maxLength={32}
          autoComplete="nickname"
          spellCheck={false}
          defaultValue={values?.nickname}
          aria-invalid={Boolean(fieldErrors.nickname)}
          aria-describedby={cx("nickname-hint", fieldErrors.nickname && "nickname-error")}
          className={inputClasses}
        />
      </Field>

      <fieldset
        aria-invalid={Boolean(fieldErrors.platforms)}
        aria-describedby={fieldErrors.platforms ? "platforms-error" : undefined}
        className="flex flex-col gap-2"
      >
        <legend className="mb-2 text-sm font-semibold">{form.platforms}</legend>
        <div className="grid grid-cols-2 gap-2">
          {platformOptions.map((platform) => (
            <label
              key={platform.value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 transition-colors has-checked:border-accent hover:border-muted"
            >
              <input
                type="checkbox"
                name="platforms"
                value={platform.value}
                defaultChecked={values?.platforms.includes(platform.value)}
                className="size-4 accent-accent"
              />
              <span translate="no">{platform.label}</span>
            </label>
          ))}
        </div>
        {errorFor("platforms") && (
          <p id="platforms-error" className="text-sm text-danger">
            {errorFor("platforms")}
          </p>
        )}
      </fieldset>

      <Field
        id="recomps"
        label={`${form.recomps} · ${form.recompsOptional}`}
        error={errorFor("recomps")}
      >
        <input
          id="recomps"
          name="recomps"
          type="text"
          maxLength={200}
          autoComplete="off"
          placeholder={form.recompsPlaceholder}
          defaultValue={values?.recomps}
          aria-invalid={Boolean(fieldErrors.recomps)}
          aria-describedby={fieldErrors.recomps ? "recomps-error" : undefined}
          className={inputClasses}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="consent"
            required
            defaultChecked={values?.consent}
            aria-invalid={Boolean(fieldErrors.consent)}
            aria-describedby={fieldErrors.consent ? "consent-error" : undefined}
            className="mt-1 size-4 shrink-0 accent-accent"
          />
          <span>{consentLabel}</span>
        </label>
        {errorFor("consent") && (
          <p id="consent-error" className="text-sm text-danger">
            {errorFor("consent")}
          </p>
        )}
      </div>

      <SubmitButton label={form.submit} pendingLabel={form.submitting} />
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-70"
    >
      {pending && (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

