"use client";

import { findUserAction } from "@/app/[lang]/moderation/actions";
import { inputClasses, SubmitButton } from "@/components/auth/FormParts";
import type { Locale } from "@/i18n/config";
import { cx } from "@/lib/cx";

export function UserSearch({ locale, label, button }: { locale: Locale; label: string; button: string }) {
  return (
    <form action={findUserAction} className="flex w-full gap-2 lg:w-auto">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="moderation-user" className="sr-only">
        {label}
      </label>
      <input id="moderation-user" name="username" required maxLength={24} placeholder={label} className={cx(inputClasses, "min-w-0 flex-1 lg:w-56")} />
      <SubmitButton variant="secondary" label={button} pendingLabel={button} />
    </form>
  );
}
