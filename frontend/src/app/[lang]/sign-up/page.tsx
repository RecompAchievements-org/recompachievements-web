import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { PlatformButtons, PlatformButtonsSkeleton } from "@/components/auth/PlatformButtons";
import { localeAlternates, localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { SignUpForm } from "./SignUpForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { auth } = await getMessages();
  return {
    title: auth.signUp.metaTitle,
    alternates: localeAlternates(locale, "/sign-up"),
    robots: { index: false, follow: true },
  };
}

export default async function SignUpPage() {
  const locale = await getLocale();
  const { auth } = await getMessages();
  const link = "text-accent underline hover:text-accent-strong";

  return (
    <AuthShell title={auth.signUp.title} intro={auth.signUp.intro}>
      <Suspense fallback={<PlatformButtonsSkeleton label={auth.platformsLoading} />}>
        <PlatformButtons />
      </Suspense>
      <SignUpForm
        locale={locale}
        challengeSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        agreement={rich(auth.agreement, {
          privacy: (
            <Link href={localizePath(locale, "/privacy")} className={link}>
              {auth.privacyLink}
            </Link>
          ),
        })}
        messages={auth}
      />
      <p className="text-sm text-muted">
        {rich(auth.signUp.haveAccount, {
          signIn: (
            <Link href={localizePath(locale, "/sign-in")} className={link}>
              {auth.signUp.signInLink}
            </Link>
          ),
        })}
      </p>
    </AuthShell>
  );
}
