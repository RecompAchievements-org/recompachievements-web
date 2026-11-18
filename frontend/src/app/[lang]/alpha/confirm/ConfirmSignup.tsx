"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import type { Messages } from "@/i18n/server";
import { confirmSignup, type ConfirmState } from "./actions";

interface ConfirmSignupProps {
  token: string;
  signUpHref: string;
  homeHref: string;
  messages: Messages["alphaConfirm"];
}

export function ConfirmSignup({ token, signUpHref, homeHref, messages }: ConfirmSignupProps) {
  const initial: ConfirmState = { status: token ? "idle" : "invalid" };
  const [state, formAction] = useActionState(confirmSignup, initial);

  if (state.status === "confirmed") {
    return (
      <Result tone="success" title={messages.successTitle} body={messages.successBody}>
        <Link href={homeHref} className="text-accent underline hover:text-accent-strong">
          {messages.backHome}
        </Link>
      </Result>
    );
  }

  if (state.status === "expired" || state.status === "invalid") {
    const expired = state.status === "expired";
    return (
      <Result
        tone="danger"
        title={expired ? messages.expiredTitle : messages.invalidTitle}
        body={expired ? messages.expiredBody : messages.invalidBody}
      >
        <Link
          href={signUpHref}
          className="inline-flex h-11 items-center self-start rounded-lg bg-accent px-6 font-semibold text-on-accent hover:bg-accent-strong"
        >
          {messages.signUpAgain}
        </Link>
      </Result>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-muted">{messages.body}</p>
      {state.status === "unavailable" && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-surface-raised p-3 text-sm text-danger">
          {messages.unavailable}
        </p>
      )}
      <ConfirmButton label={messages.button} pendingLabel={messages.confirming} />
    </form>
  );
}

function Result({
  tone,
  title,
  body,
  children,
}: {
  tone: "success" | "danger";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Card role="status" className={tone === "success" ? "flex flex-col gap-3 border-success/40" : "flex flex-col gap-3 border-danger/40"}>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-muted">{body}</p>
      {children}
    </Card>
  );
}

function ConfirmButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-70"
    >
      {pending && (
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
