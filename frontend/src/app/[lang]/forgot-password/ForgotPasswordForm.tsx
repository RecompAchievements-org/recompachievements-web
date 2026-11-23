"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, HumanCheckSubmit, inputClasses, ResultCard } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { challengeActions } from "@/lib/auth/forms";
import { requestPasswordLink, type ForgotPasswordState } from "./actions";

interface ForgotPasswordFormProps {
  locale: Locale;
  challengeSiteKey: string;
  signInHref: string;
  messages: Messages["auth"];
}

export function ForgotPasswordForm({ locale, challengeSiteKey, signInHref, messages }: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState(requestPasswordLink, { status: "idle" } satisfies ForgotPasswordState);
  const { fields, errors, forgotPassword: copy } = messages;
  const backLink = (
    <Link href={signInHref} className="text-sm text-accent underline hover:text-accent-strong">
      {copy.backToSignIn}
    </Link>
  );

  if (state.status === "sent") {
    return (
      <ResultCard tone="success" title={copy.successTitle}>
        <p className="text-muted">{copy.successBody}</p>
        {backLink}
      </ResultCard>
    );
  }

  const fieldError = state.status === "error" ? state.fieldError : null;

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={state.status === "error" ? errors[state.error] : null} />
      <Field id="email" label={fields.email} error={fieldError ? errors[fieldError] : null}>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          placeholder={fields.emailPlaceholder}
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? "email-error" : undefined}
          className={inputClasses}
        />
      </Field>
      <HumanCheckSubmit
        siteKey={challengeSiteKey}
        action={challengeActions.forgotPassword}
        locale={locale}
        label={copy.submit}
        pendingLabel={copy.submitting}
      />
      {backLink}
    </form>
  );
}
