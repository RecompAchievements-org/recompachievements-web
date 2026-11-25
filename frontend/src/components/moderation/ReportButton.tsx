"use client";

import { useActionState, useId, useRef, useState } from "react";
import { FormMessage, inputClasses, SubmitButton } from "@/components/auth/FormParts";
import { cx } from "@/lib/cx";
import { submitReport, type ReportState } from "./actions";

export interface ReportLabels {
  button: string;
  title: string;
  intro: string;
  what: string;
  targets: { profile: string; photo: string; comment: string };
  reason: string;
  reasons: Record<"sexual" | "violence" | "hate" | "harassment" | "copyright" | "personal_info" | "spam" | "other", string>;
  details: string;
  send: string;
  sending: string;
  cancel: string;
  close: string;
  sent: string;
}

type Target = keyof ReportLabels["targets"];

// Reports a profile, photo, or comment through a dialog that works with touch and keyboard.
export function ReportButton({
  username,
  targets,
  commentId,
  labels,
  errors,
  accessibleLabel,
  className,
}: {
  username: string;
  targets: Target[];
  commentId?: string;
  labels: ReportLabels;
  errors: Record<string, string>;
  accessibleLabel?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const baseId = useId();
  const [target, setTarget] = useState<Target>(targets[0]);
  const [formKey, setFormKey] = useState(0);

  function open() {
    setFormKey((key) => key + 1);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button type="button" onClick={open} aria-label={accessibleLabel} className={className}>
        <span className="inline-flex items-center gap-1.5">
          <ReportFlag className="size-4" />
          {labels.button}
        </span>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${baseId}-title`}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border-strong bg-surface p-5 text-foreground backdrop:bg-background/75"
      >
        <h2 id={`${baseId}-title`} className="flex items-center gap-2 font-display text-xl font-semibold">
          <ReportFlag className="size-5 text-danger" />
          {labels.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{labels.intro}</p>
        <ReportForm
          key={formKey}
          baseId={baseId}
          username={username}
          targets={targets}
          target={target}
          onTarget={setTarget}
          commentId={commentId}
          labels={labels}
          errors={errors}
          onClose={() => dialogRef.current?.close()}
        />
      </dialog>
    </>
  );
}

function ReportForm({
  baseId,
  username,
  targets,
  target,
  onTarget,
  commentId,
  labels,
  errors,
  onClose,
}: {
  baseId: string;
  username: string;
  targets: Target[];
  target: Target;
  onTarget: (target: Target) => void;
  commentId?: string;
  labels: ReportLabels;
  errors: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState(submitReport, { status: "idle" } satisfies ReportState);
  const secondary = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong bg-surface-raised px-5 font-semibold transition-colors hover:border-accent";

  if (state.status === "sent") {
    return (
      <div className="mt-4 flex flex-col gap-4">
        <FormMessage tone="success" message={labels.sent} />
        <button type="button" onClick={onClose} className={secondary}>
          {labels.close}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="targetUsername" value={username} />
      <input type="hidden" name="targetType" value={target} />
      {commentId && <input type="hidden" name="commentId" value={commentId} />}
      {targets.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{labels.what}</legend>
          {targets.map((option) => (
            <label key={option} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="radio" name={`${baseId}-target`} checked={target === option} onChange={() => onTarget(option)} className="size-4 accent-accent" />
              {labels.targets[option]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-reason`} className="text-sm font-semibold">
          {labels.reason}
        </label>
        <select id={`${baseId}-reason`} name="reason" required defaultValue="" className={inputClasses}>
          <option value="" disabled />
          {Object.entries(labels.reasons).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-details`} className="text-sm font-semibold">
          {labels.details}
        </label>
        <textarea id={`${baseId}-details`} name="details" rows={3} maxLength={500} className={cx(inputClasses, "resize-none")} />
      </div>
      {state.status === "error" && <FormMessage message={errors[state.error] ?? errors.unavailable} />}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <SubmitButton label={labels.send} pendingLabel={labels.sending} variant="danger" className="flex-1" />
        <button type="button" onClick={onClose} className={cx(secondary, "flex-1")}>
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}

// The report flag, shared by the button and the dialog title; decorative, the text names the action.
function ReportFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={cx("shrink-0", className)}>
      <path d="M4.5 18V3M4.5 4h10l-2.5 3.5 2.5 3.5h-10" />
    </svg>
  );
}
