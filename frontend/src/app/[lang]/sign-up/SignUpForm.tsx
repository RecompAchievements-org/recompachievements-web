"use client";

import { useActionState } from "react";
import { FormMessage, HumanCheckSubmit, ResultCard } from "@/components/auth/FormParts";
import { EmailField, UsernameField } from "@/components/auth/LiveFields";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { challengeActions } from "@/lib/auth/forms";
import { signUp, type SignUpState } from "./actions";

interface SignUpFormProps {
  locale: Locale;
  challengeSiteKey: string;
  agreement: React.ReactNode;
  messages: Messages["auth"];
}

export function SignUpForm({ locale, challengeSiteKey, agreement, messages }: SignUpFormProps) {
  const [state, formAction] = useActionState(signUp, { status: "idle" } satisfies SignUpState);
  const { fields, errors, signUp: copy } = messages;

  if (state.status === "sent") {
    return (
      <ResultCard tone="success" title={copy.successTitle}>
        <div className="flex flex-col gap-1">
          <p>{copy.successSentTo}</p>
          <p className="font-semibold wrap-anywhere">{state.email}</p>
          <p>{copy.successExpiry}</p>
        </div>
        <p className="text-sm text-muted">{copy.successSpam}</p>
      </ResultCard>
    );
  }

  const values = state.status === "error" ? state.values : null;
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const errorFor = (field: keyof typeof fieldErrors) => {
    const code = fieldErrors[field];
    return code ? errors[code] : null;
  };

  return (
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={state.status === "error" ? errors[state.error] : null} />

      <EmailField labels={{ label: fields.email, placeholder: fields.emailPlaceholder, valid: fields.emailValid, invalid: errors.email }} defaultValue={values?.email} serverError={errorFor("email")} />

      <UsernameField labels={{ label: fields.username, hint: fields.usernameHint, invalid: errors.usernameFormat, checking: fields.usernameChecking, available: fields.usernameAvailable, taken: errors.username_taken }} defaultValue={values?.username} serverError={errorFor("username")} />

      <NewPasswordFields
        labels={{ password: fields.password, confirm: fields.confirmPassword, hint: fields.passwordHint, match: fields.passwordsMatch, mismatch: errors.passwordMismatch }}
        passwordError={errorFor("password")}
        confirmError={errorFor("confirmPassword")}
      />

      <p className="text-sm text-muted">{agreement}</p>

      <HumanCheckSubmit
        siteKey={challengeSiteKey}
        action={challengeActions.signUp}
        locale={locale}
        label={copy.submit}
        pendingLabel={copy.submitting}
      />
    </form>
  );
}
