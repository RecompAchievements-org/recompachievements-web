"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { Field, inputClasses } from "./FormParts";
import { FieldStatus } from "./LiveFields";

export interface NewPasswordLabels {
  password: string;
  confirm: string;
  hint: string;
  match: string;
  mismatch: string;
}

/** A new password and its confirmation, for every form that creates or changes a password. While
 *  the player types the confirmation, a live line says whether the two match; the server still
 *  compares them on submit, and its errors show until the field is edited again.
**/
export function NewPasswordFields({
  labels,
  passwordError,
  confirmError,
}: {
  labels: NewPasswordLabels;
  passwordError: string | null;
  confirmError: string | null;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmEdited, setConfirmEdited] = useState(false);

  const matches = confirm.length > 0 && confirm === password;
  const mismatched = confirm.length > 0 && confirm !== password;
  const shownConfirmError = confirmEdited ? null : confirmError;

  return (
    <>
      <Field id="password" label={labels.password} hint={labels.hint} error={passwordError}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={cx("password-hint", passwordError && "password-error")}
          className={inputClasses}
        />
      </Field>

      <Field id="confirmPassword" label={labels.confirm} error={shownConfirmError}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          maxLength={128}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setConfirmEdited(true);
          }}
          aria-invalid={mismatched || Boolean(shownConfirmError)}
          aria-describedby={cx("confirmPassword-status", shownConfirmError && "confirmPassword-error")}
          className={inputClasses}
        />
        <FieldStatus id="confirmPassword-status" tone={matches ? "success" : mismatched ? "danger" : null}>
          {matches ? labels.match : labels.mismatch}
        </FieldStatus>
      </Field>
    </>
  );
}
