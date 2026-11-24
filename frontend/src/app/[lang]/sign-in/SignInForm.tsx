"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, inputClasses, SubmitButton } from "@/components/auth/FormParts";
import { EmailField } from "@/components/auth/LiveFields";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { signInWithEmail, type SignInState } from "./actions";

interface SignInFormProps {
  locale: Locale;
  forgotHref: string;
  messages: Messages["auth"];
}

export function SignInForm({ locale, forgotHref, messages }: SignInFormProps) {
  const [state, formAction] = useActionState(signInWithEmail, { status: "idle" } satisfies SignInState);
  const { fields, errors, signIn } = messages;
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const message = state.status === "error" ? errors[state.error] : null;

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={message} />

      <EmailField labels={{ label: fields.email, placeholder: fields.emailPlaceholder, valid: fields.emailValid, invalid: errors.email }} defaultValue={state.status === "error" ? state.email : undefined} serverError={fieldErrors.email ? errors[fieldErrors.email] : null} />

      <Field id="password" label={fields.password} error={fieldErrors.password ? errors[fieldErrors.password] : null}>
        <input
          id="password"
          name="password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
          className={inputClasses}
        />
      </Field>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton label={signIn.submit} pendingLabel={signIn.submitting} className="w-full sm:w-auto" />
        <Link href={forgotHref} className="text-sm text-accent underline hover:text-accent-strong">
          {signIn.forgot}
        </Link>
      </div>
    </form>
  );
}
