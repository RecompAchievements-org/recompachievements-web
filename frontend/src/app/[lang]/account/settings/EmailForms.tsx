"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClasses, SubmitButton } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import { addEmailAction, type AddEmailState } from "./actions";

interface FormProps {
  locale: Locale;
  messages: Messages["auth"];
}

/** Adds an email (typed in, or a platform's email offered with `offer`). Either way it only becomes
 *  the account email after our confirmation link is followed.
**/
export function AddEmailForm({ locale, messages, offer }: FormProps & { offer?: string }) {
  const [state, formAction] = useActionState(addEmailAction, { status: "idle" } satisfies AddEmailState);
  const { fields, errors, account } = messages;

  if (state.status === "sent") {
    return <FormMessage tone="success" message={interpolate(account.emailSent, { email: state.email })} />;
  }

  const fieldError = state.status === "error" ? state.fieldError : null;
  const message = state.status === "error" && !fieldError ? errors[state.error] : null;

  if (offer) {
    return (
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="email" value={offer} />
        <FormMessage message={message} />
        <SubmitButton label={account.offerAccept} pendingLabel={account.addingEmail} className="w-full sm:w-auto sm:self-start" />
      </form>
    );
  }

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={message} />
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
      <SubmitButton label={account.addEmail} pendingLabel={account.addingEmail} className="w-full sm:w-auto sm:self-start" />
    </form>
  );
}
