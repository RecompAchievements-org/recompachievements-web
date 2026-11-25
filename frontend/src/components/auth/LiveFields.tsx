"use client";

import { useEffect, useState, type ReactNode } from "react";
import { emailPattern, usernamePattern } from "@/lib/auth/forms";
import { cx } from "@/lib/cx";
import { checkUsernameAvailability, type UsernameCheck } from "./fieldActions";
import { Field, inputClasses } from "./FormParts";

const availabilityDelayMs = 400;
const usernameCharacters = /^[A-Za-z0-9_-]*$/;

/** The live line under a field: a check for good input, a cross for a problem, or a neutral note
 *  (such as "checking"). While empty it takes no space, so fields stay close together; it stays in
 *  the page (visually hidden) so screen readers announce it when it appears.
**/
export function FieldStatus({ id, tone, children }: { id: string; tone: "success" | "danger" | "muted" | null; children?: ReactNode }) {
  const shown = Boolean(tone && children);
  return (
    <p
      id={id}
      aria-live="polite"
      className={cx(
        shown ? "flex items-center gap-1.5 text-sm" : "sr-only",
        tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted",
      )}
    >
      {shown && (
        <>
          {tone !== "muted" && (
            <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
              {tone === "success" ? <path d="m4.5 10.5 3.5 3.5 7.5-8" /> : <path d="M5.5 5.5l9 9m0-9-9 9" />}
            </svg>
          )}
          {children}
        </>
      )}
    </p>
  );
}

export interface EmailLabels {
  label: string;
  placeholder: string;
  valid: string;
  invalid: string;
}

/** An email field that confirms a well-formed address as it's typed. A problem is shown only after
 *  the field is left, so typing isn't interrupted; the server still checks on submit.
**/
export function EmailField({
  labels,
  defaultValue,
  serverError,
  autoComplete = "email",
}: {
  labels: EmailLabels;
  defaultValue?: string;
  serverError: string | null;
  autoComplete?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [left, setLeft] = useState(false);
  const [edited, setEdited] = useState(false);

  const trimmed = value.trim();
  const valid = trimmed.length <= 254 && emailPattern.test(trimmed);
  const showProblem = trimmed.length > 0 && !valid && left;
  const shownServerError = edited ? null : serverError;

  return (
    <Field id="email" label={labels.label} error={shownServerError}>
      <input
        id="email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete={autoComplete}
        spellCheck={false}
        placeholder={labels.placeholder}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setEdited(true);
        }}
        onBlur={() => setLeft(true)}
        aria-invalid={showProblem || Boolean(shownServerError)}
        aria-describedby={cx("email-status", shownServerError && "email-error")}
        className={inputClasses}
      />
      <FieldStatus id="email-status" tone={valid ? "success" : showProblem ? "danger" : null}>
        {valid ? labels.valid : labels.invalid}
      </FieldStatus>
    </Field>
  );
}

export interface UsernameLabels {
  label: string;
  hint: string;
  invalid: string;
  checking: string;
  available: string;
  taken: string;
  reserved: string;
}

/** A username field that checks the format as it's typed and, once it's valid, asks whether the
 *  name is still free (after a short pause, so not on every keystroke). The server decides again
 *  on submit, because someone else could take the name in between.
**/
export function UsernameField({
  labels,
  defaultValue,
  serverError,
}: {
  labels: UsernameLabels;
  defaultValue?: string;
  serverError: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [left, setLeft] = useState(false);
  const [edited, setEdited] = useState(false);
  const [checked, setChecked] = useState<{ name: string; result: UsernameCheck } | null>(null);

  const formatOk = usernamePattern.test(value);
  // Characters that can never be allowed are flagged at once; length waits until the field is left.
  const showFormatProblem = value.length > 0 && !formatOk && (left || !usernameCharacters.test(value) || value.length > 24);
  const shownServerError = edited ? null : serverError;

  useEffect(() => {
    if (!formatOk) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      if (!cancelled) setChecked({ name: value, result });
    }, availabilityDelayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, formatOk]);

  const availability = formatOk ? (checked?.name === value ? checked.result : "checking") : null;
  const status: { tone: "success" | "danger" | "muted" | null; text?: string } = showFormatProblem
    ? { tone: "danger", text: labels.invalid }
    : availability === "available"
      ? { tone: "success", text: labels.available }
      : availability === "taken"
        ? { tone: "danger", text: labels.taken }
        : availability === "reserved"
          ? { tone: "danger", text: labels.reserved }
        : availability === "checking"
          ? { tone: "muted", text: labels.checking }
          : { tone: null };

  return (
    <Field id="username" label={labels.label} hint={labels.hint} error={shownServerError}>
      <input
        id="username"
        name="username"
        type="text"
        required
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z0-9_\-]{3,24}"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setEdited(true);
        }}
        onBlur={() => setLeft(true)}
        aria-invalid={showFormatProblem || availability === "taken" || availability === "reserved" || Boolean(shownServerError)}
        aria-describedby={cx("username-hint", "username-status", shownServerError && "username-error")}
        className={inputClasses}
      />
      <FieldStatus id="username-status" tone={status.tone}>
        {status.text}
      </FieldStatus>
    </Field>
  );
}
