import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResultCard } from "@/components/auth/FormParts";
import { platformNames } from "@/components/auth/platformNames";
import { localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { getPendingSignup } from "@/lib/auth/session";
import { WelcomeForm } from "./WelcomeForm";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  return { title: auth.welcome.metaTitle, robots: { index: false, follow: false } };
}

export default async function WelcomePage() {
  const { auth } = await getMessages();

  return (
    <AuthShell title={auth.welcome.title} intro={auth.welcome.intro}>
      {/** The pending sign-up lives in a cookie, so this part is rendered per request. **/}
      <Suspense>
        <WelcomePanel />
      </Suspense>
    </AuthShell>
  );
}

/** Shows, before anything is created, which email the new account will use, or that it will have
 *  none yet and needs one before achievements are tracked.
**/
async function WelcomePanel() {
  const locale = await getLocale();
  const { auth } = await getMessages();
  const pending = await getPendingSignup();
  const signInHref = localizePath(locale, "/sign-in");
  const link = "text-accent underline hover:text-accent-strong";

  if (!pending) {
    return (
      <ResultCard tone="danger" title={auth.welcome.expiredTitle}>
        <p className="text-muted">{auth.welcome.expiredBody}</p>
        <Link
          href={signInHref}
          className="inline-flex min-h-11 items-center self-start rounded-lg bg-accent px-5 font-semibold text-on-accent hover:bg-accent-strong"
        >
          {auth.welcome.startAgain}
        </Link>
      </ResultCard>
    );
  }

  const platform = <span translate="no">{platformNames[pending.platform]}</span>;

  return (
    <>
      <section aria-labelledby="welcome-email" className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4">
        <h2 id="welcome-email" className="text-sm font-semibold">
          {auth.welcome.emailHeading}
        </h2>
        <p className={pending.email ? "text-foreground" : "text-gold"}>
          {pending.email
            ? rich(auth.welcome.withEmail, { email: <strong className="wrap-anywhere">{pending.email}</strong>, platform })
            : auth.welcome.noEmail}
        </p>
      </section>
      <WelcomeForm locale={locale} suggestedUsername={pending.suggestedUsername} signInHref={signInHref} messages={auth} />
      <p className="text-sm text-muted">
        {rich(auth.agreement, {
          privacy: (
            <Link href={localizePath(locale, "/privacy")} className={link}>
              {auth.privacyLink}
            </Link>
          ),
        })}
      </p>
    </>
  );
}
