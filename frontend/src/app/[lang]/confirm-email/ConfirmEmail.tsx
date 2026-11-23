"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, ResultCard, SubmitButton } from "@/components/auth/FormParts";
import type { Messages } from "@/i18n/server";
import { confirmEmailAction, type ConfirmEmailState } from "./actions";

interface ConfirmEmailProps {
  token: string;
  continueHref: string;
  messages: Messages["auth"];
}

export function ConfirmEmail({ token, continueHref, messages }: ConfirmEmailProps) {
  const [state, formAction] = useActionState(confirmEmailAction, { status: token ? "idle" : "invalid" } satisfies ConfirmEmailState);
  const copy = messages.confirmEmail;
  const continueLink = (
    <Link
      href={continueHref}
      className="inline-flex min-h-11 items-center self-start rounded-lg bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
    >
      {copy.continue}
    </Link>
  );

  if (state.status === "confirmed") {
    return (
      <ResultCard tone="success" title={copy.successTitle}>
        <p className="text-muted">{copy.successBody}</p>
        {continueLink}
      </ResultCard>
    );
  }

  if (state.status === "expired" || state.status === "invalid" || state.status === "inUse") {
    const [title, body] =
      state.status === "expired"
        ? [copy.expiredTitle, copy.expiredBody]
        : state.status === "inUse"
          ? [copy.inUseTitle, copy.inUseBody]
          : [copy.invalidTitle, copy.invalidBody];
    return (
      <ResultCard tone="danger" title={title}>
        <p className="text-muted">{body}</p>
        {continueLink}
      </ResultCard>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-muted">{copy.body}</p>
      <FormMessage message={state.status === "unavailable" ? messages.errors.unavailable : null} />
      <SubmitButton label={copy.button} pendingLabel={copy.confirming} className="w-full sm:w-auto sm:self-start" />
    </form>
  );
}
