"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, inputClasses, ResultCard, SubmitButton } from "@/components/auth/FormParts";
import type { Messages } from "@/i18n/server";
import { cx } from "@/lib/cx";
import { savePassword, type ResetPasswordState } from "./actions";

interface ResetPasswordFormProps {
  token: string;
  signInHref: string;
  forgotHref: string;
  messages: Messages["auth"];
}

export function ResetPasswordForm({ token, signInHref, forgotHref, messages }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState(savePassword, { status: token ? "idle" : "invalid" } satisfies ResetPasswordState);
  const { fields, errors, resetPassword: copy } = messages;
  const buttonLink = "inline-flex min-h-11 items-center self-start rounded-lg bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong";

  if (state.status === "saved") {
    return (
      <ResultCard tone="success" title={copy.successTitle}>
        <p className="text-muted">{copy.successBody}</p>
        <Link href={signInHref} className={buttonLink}>
          {copy.signIn}
        </Link>
      </ResultCard>
    );
  }

  if (state.status === "expired" || state.status === "invalid") {
    const expired = state.status === "expired";
    return (
      <ResultCard tone="danger" title={expired ? copy.expiredTitle : copy.invalidTitle}>
        <p className="text-muted">{expired ? copy.expiredBody : copy.invalidBody}</p>
        <Link href={forgotHref} className={buttonLink}>
          {copy.requestNew}
        </Link>
      </ResultCard>
    );
  }

  const fieldError = state.status === "fieldError" && state.field === "password" ? state.fieldError : null;
  const confirmError = state.status === "fieldError" && state.field === "confirmPassword" ? state.fieldError : null;
  const message = state.status === "unavailable" || state.status === "rateLimited" ? errors[state.status] : null;

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage message={message} />
      <Field id="password" label={fields.newPassword} hint={fields.passwordHint} error={fieldError ? errors[fieldError] : null}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={cx("password-hint", fieldError && "password-error")}
          className={inputClasses}
        />
      </Field>
      <Field id="confirmPassword" label={fields.confirmNewPassword} error={confirmError ? errors[confirmError] : null}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(confirmError)}
          aria-describedby={confirmError ? "confirmPassword-error" : undefined}
          className={inputClasses}
        />
      </Field>
      <SubmitButton label={copy.submit} pendingLabel={copy.submitting} className="w-full sm:w-auto sm:self-start" />
    </form>
  );
}
