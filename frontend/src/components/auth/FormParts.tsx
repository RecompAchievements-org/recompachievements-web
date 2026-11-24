"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { HumanCheck } from "@/components/ui/HumanCheck";
import type { Locale } from "@/i18n/config";
import { cx } from "@/lib/cx";

// Shared pieces of the account forms (sign-in, sign-up, password, welcome, account page).

export const inputClasses =
  "w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-foreground placeholder:text-subtle transition-colors hover:border-muted aria-[invalid=true]:border-danger";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
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

// The form's error line; announced to screen readers when it changes.
export function FormMessage({ message, tone = "danger" }: { message: string | null; tone?: "danger" | "success" }) {
  return (
    <p
      aria-live="polite"
      className={cx(
        "text-sm",
        message
          ? cx("rounded-lg border bg-surface-raised p-3", tone === "danger" ? "border-danger/40 text-danger" : "border-success/40 text-success")
          : "sr-only",
      )}
    >
      {message ?? ""}
    </p>
  );
}

export function SubmitButton({
  label,
  pendingLabel,
  ready = true,
  variant = "primary",
  icon,
  className,
}: {
  label: string;
  pendingLabel: string;
  ready?: boolean;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2 text-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-accent text-on-accent hover:bg-accent-strong disabled:hover:bg-accent"
          : "border border-border-strong bg-surface-raised text-foreground hover:border-accent",
        className,
      )}
    >
      {pending && (
        <span
          aria-hidden="true"
          className={cx(
            "size-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent",
            variant === "primary" ? "border-on-accent" : "border-foreground",
          )}
        />
      )}
      {!pending && icon}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** The human-verification box plus the submit button, for forms that send email. It remounts with
 *  the form after each attempt (give the form a key), so every attempt gets a fresh single-use
 *  token; the button waits for it.
**/
export function HumanCheckSubmit({
  siteKey,
  action,
  locale,
  label,
  pendingLabel,
}: {
  siteKey: string;
  action: string;
  locale: Locale;
  label: string;
  pendingLabel: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {siteKey && <HumanCheck siteKey={siteKey} action={action} locale={locale} onToken={setToken} />}
      <input type="hidden" name="turnstileToken" value={token ?? ""} />
      <SubmitButton label={label} pendingLabel={pendingLabel} ready={token !== null} className="w-full sm:w-auto sm:self-start" />
    </div>
  );
}

// Result card shown after a form finishes (sent, saved, expired…).
export function ResultCard({
  tone,
  title,
  children,
}: {
  tone: "success" | "danger";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-3 rounded-xl border bg-surface p-5",
        tone === "success" ? "border-success/40" : "border-danger/40",
      )}
    >
      <h2 className="font-display text-2xl font-bold text-balance">{title}</h2>
      {children}
    </div>
  );
}
