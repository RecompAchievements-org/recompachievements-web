"use client";

import { useActionState, useId } from "react";
import { moderationAction, type ModerationState } from "@/app/[lang]/moderation/actions";
import { FormMessage, inputClasses, SubmitButton } from "@/components/auth/FormParts";
import type { Messages } from "@/i18n/server";
import type { UserRole } from "@/lib/api/moderation";
import { cx } from "@/lib/cx";

type Labels = Messages["moderation"]["actions"];
type Operation = keyof Labels["ops"];

export interface ControlTarget {
  username: string | null;
  role: UserRole | null;
  isEnabled: boolean;
  isMuted: boolean;
  hasPhoto: boolean;
  reportId?: string;
  commentId?: string;
  reportOpen?: boolean;
}

// The actions this staff member may take here; the API checks every one again.
export function ModerationControls({
  target,
  canAct,
  isAdmin,
  labels,
  errors,
}: {
  target: ControlTarget;
  canAct: boolean;
  isAdmin: boolean;
  labels: Labels;
  errors: Messages["auth"]["errors"];
}) {
  /** The result lives here because a finished action can remove its own form (a removed photo has
   *  nothing left to remove), and a storage warning must stay visible.
  **/
  const [state, action] = useActionState(moderationAction, { status: "idle" } satisfies ModerationState);

  if (!canAct) return <p className="text-sm text-muted">{labels.notAllowed}</p>;

  const ops: Operation[] = [
    ...(target.reportOpen ? (["resolve", "dismiss"] as const) : []),
    ...(target.commentId ? (["remove_comment"] as const) : []),
    ...(target.username && target.hasPhoto ? (["remove_photo"] as const) : []),
    ...(target.username ? ([target.isMuted ? "unmute" : "mute"] as const) : []),
    ...(target.username && isAdmin ? (["role"] as const) : []),
    // The severe actions (shown in red) come last.
    ...(target.username ? ([target.isEnabled ? "disable" : "enable"] as const) : []),
    ...(target.username && target.hasPhoto && isAdmin ? (["legal_hold"] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      {state.status === "error" && <FormMessage message={errors[state.error]} />}
      {state.status === "done" && (
        <FormMessage
          tone={state.cachePurged && !state.heldWithoutEvidence ? "success" : "danger"}
          message={state.heldWithoutEvidence ? labels.noEvidence : state.cachePurged ? labels.done : labels.cacheWarning}
        />
      )}
      <div className="flex flex-col divide-y divide-border">
        {ops.map((op) => (
          <ActionForm key={op} op={op} target={target} labels={labels} action={action} />
        ))}
      </div>
    </div>
  );
}

function ActionForm({ op, target, labels, action }: { op: Operation; target: ControlTarget; labels: Labels; action: (formData: FormData) => void }) {
  const id = useId();
  const copy = labels.ops[op];
  const danger = op === "legal_hold" || op === "disable";

  return (
    <details className="group py-1">
      <summary className={cx("flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 font-semibold hover:bg-surface-raised", danger && "text-danger")}>
        {copy.title}
        <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0 text-muted group-open:rotate-180">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <form action={action} className="flex flex-col gap-3 px-2 pt-2 pb-4">
        <p className="text-sm text-muted">{copy.body}</p>
        <input type="hidden" name="op" value={op} />
        {target.username && <input type="hidden" name="username" value={target.username} />}
        {target.reportId && target.reportOpen && <input type="hidden" name="reportId" value={target.reportId} />}
        {target.commentId && <input type="hidden" name="commentId" value={target.commentId} />}
        {op === "mute" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-days`} className="text-sm font-semibold">
              {labels.duration}
            </label>
            <select id={`${id}-days`} name="days" defaultValue="7" className={inputClasses}>
              {[1, 3, 7, 14, 30, 90, 365].map((days) => (
                <option key={days} value={days}>
                  {labels.days.replace("{count}", String(days))}
                </option>
              ))}
            </select>
          </div>
        )}
        {op === "role" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-role`} className="text-sm font-semibold">
              {labels.newRole}
            </label>
            <select id={`${id}-role`} name="role" defaultValue={target.role ?? "player"} className={inputClasses}>
              {(["player", "moderator", "admin"] as const).map((role) => (
                <option key={role} value={role}>
                  {labels.roles[role]}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
            {labels.reason}
          </label>
          <textarea id={`${id}-reason`} name="reason" required maxLength={500} rows={2} className={cx(inputClasses, "resize-none")} />
          {["remove_comment", "remove_photo", "mute", "disable"].includes(op) && <p className="text-xs text-subtle">{labels.reasonShared}</p>}
        </div>
        <SubmitButton variant={danger ? "secondary" : "primary"} label={copy.submit} pendingLabel={labels.working} className="w-full sm:w-auto sm:self-start" />
      </form>
    </details>
  );
}
