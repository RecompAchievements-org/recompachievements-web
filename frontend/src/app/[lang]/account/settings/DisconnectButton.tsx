"use client";

import { useId, useRef, useTransition } from "react";
import { PlatformIcon } from "@/components/auth/PlatformIcon";
import { platformNames } from "@/components/auth/platformNames";
import type { Locale } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import type { Messages } from "@/i18n/server";
import type { Platform } from "@/lib/api/accounts";
import { disconnectAction } from "./actions";

const dangerClasses =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger px-5 py-2 text-center font-semibold text-on-accent transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60";

/** Disconnecting needs a second confirmation in a dialog, which opens with focus on Cancel. The
 *  dialog closes before the request, so a refusal shown at the top of Settings is never hidden.
**/
export function DisconnectButton({ platform, locale, messages }: { platform: Platform; locale: Locale; messages: Messages["auth"]["account"] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const name = platformNames[platform];

  function confirm() {
    dialogRef.current?.close();
    const form = new FormData();
    form.set("platform", platform);
    form.set("locale", locale);
    startTransition(() => disconnectAction(form));
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={() => dialogRef.current?.showModal()} className={`${dangerClasses} w-full sm:w-auto`}>
        {pending ? messages.disconnecting : messages.disconnect}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border-strong bg-surface p-5 text-foreground backdrop:bg-background/75"
      >
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} className="size-6" />
          <h2 id={titleId} className="font-display text-xl font-semibold wrap-anywhere">
            {interpolate(messages.disconnectTitle, { platform: name })}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{interpolate(messages.disconnectBody, { platform: name })}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
          <button type="button" onClick={confirm} className={`${dangerClasses} flex-1`}>
            {interpolate(messages.disconnectConfirm, { platform: name })}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-5 font-semibold transition-colors hover:border-accent"
          >
            {messages.disconnectCancel}
          </button>
        </div>
      </dialog>
    </>
  );
}
