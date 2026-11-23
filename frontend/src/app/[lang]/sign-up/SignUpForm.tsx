"use client";

import { useActionState } from "react";
import { Field, FormMessage, HumanCheckSubmit, inputClasses, ResultCard } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/server";
import { cx } from "@/lib/cx";
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

      <Field id="email" label={fields.email} error={errorFor("email")}>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          placeholder={fields.emailPlaceholder}
          defaultValue={values?.email}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={inputClasses}
        />
      </Field>

      <Field id="username" label={fields.username} hint={fields.usernameHint} error={errorFor("username")}>
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
          defaultValue={values?.username}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={cx("username-hint", fieldErrors.username && "username-error")}
          className={inputClasses}
        />
      </Field>

      <Field id="password" label={fields.password} hint={fields.passwordHint} error={errorFor("password")}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={cx("password-hint", fieldErrors.password && "password-error")}
          className={inputClasses}
        />
      </Field>

      <Field id="confirmPassword" label={fields.confirmPassword} error={errorFor("confirmPassword")}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
          aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
          className={inputClasses}
        />
      </Field>

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
