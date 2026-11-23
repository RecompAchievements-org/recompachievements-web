"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { sendPasswordLink, type PasswordLinkState } from "./actions";

export function PasswordLinkForm({ locale, label, messages }: { locale: Locale; label: string; messages: Messages["auth"] }) {
  const [state, formAction] = useActionState(sendPasswordLink, { status: "idle" } satisfies PasswordLinkState);
  const { errors, settings } = messages;

  if (state.status === "sent") return <FormMessage tone="success" message={settings.passwordLinkSent} />;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={state.status === "error" ? errors[state.error] : null} />
      <SubmitButton
        variant="secondary"
        label={label}
        pendingLabel={settings.sendingPasswordLink}
        className="w-full sm:w-auto sm:self-start"
      />
    </form>
  );
}
