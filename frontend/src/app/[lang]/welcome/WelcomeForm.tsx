"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, ResultCard, SubmitButton } from "@/components/auth/FormParts";
import { UsernameField } from "@/components/auth/LiveFields";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { createPlatformAccount, type WelcomeState } from "./actions";

interface WelcomeFormProps {
  locale: Locale;
  suggestedUsername: string;
  signInHref: string;
  messages: Messages["auth"];
}

export function WelcomeForm({ locale, suggestedUsername, signInHref, messages }: WelcomeFormProps) {
  const [state, formAction] = useActionState(createPlatformAccount, { status: "idle" } satisfies WelcomeState);
  const { fields, errors, welcome: copy } = messages;

  if (state.status === "error" && (state.error === "signup_expired" || state.error === "platform_linked_elsewhere")) {
    return (
      <ResultCard tone="danger" title={copy.expiredTitle}>
        <p className="text-muted">{state.error === "signup_expired" ? copy.expiredBody : errors.platform_linked_elsewhere}</p>
        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center self-start rounded-lg bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
        >
          {copy.startAgain}
        </Link>
      </ResultCard>
    );
  }

  const fieldError = state.status === "error" ? state.fieldError : null;

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={state.status === "error" && !fieldError ? errors[state.error] : null} />
      <UsernameField labels={{ label: fields.username, hint: fields.usernameHint, invalid: errors.usernameFormat, checking: fields.usernameChecking, available: fields.usernameAvailable, taken: errors.username_taken, reserved: errors.username_reserved }} defaultValue={state.status === "error" ? state.username : suggestedUsername} serverError={fieldError ? errors[fieldError] : null} />
      <SubmitButton label={copy.submit} pendingLabel={copy.submitting} className="w-full sm:w-auto sm:self-start" />
    </form>
  );
}
