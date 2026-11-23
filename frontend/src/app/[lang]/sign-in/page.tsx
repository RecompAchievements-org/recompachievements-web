import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { FormMessage } from "@/components/auth/FormParts";
import { PlatformButtons } from "@/components/auth/PlatformButtons";
import { localeAlternates, localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { isAuthError } from "@/lib/auth/forms";
import { SignInForm } from "./SignInForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { auth } = await getMessages();
  return {
    title: auth.signIn.metaTitle,
    alternates: localeAlternates(locale, "/sign-in"),
    robots: { index: false, follow: true },
  };
}

export default async function SignInPage({ searchParams }: PageProps<"/[lang]/sign-in">) {
  const locale = await getLocale();
  const { auth } = await getMessages();

  return (
    <AuthShell title={auth.signIn.title} intro={auth.signIn.intro}>
      {/** Errors sent back by the Discord/GitHub callback arrive in the URL. **/}
      <Suspense>
        <CallbackError searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <PlatformButtons />
      </Suspense>
      <SignInForm locale={locale} forgotHref={localizePath(locale, "/forgot-password")} messages={auth} />
      <p className="text-sm text-muted">
        {rich(auth.signIn.noAccount, {
          signUp: (
            <Link href={localizePath(locale, "/sign-up")} className="text-accent underline hover:text-accent-strong">
              {auth.signIn.signUpLink}
            </Link>
          ),
        })}
      </p>
    </AuthShell>
  );
}

async function CallbackError({ searchParams }: Pick<PageProps<"/[lang]/sign-in">, "searchParams">) {
  const { auth } = await getMessages();
  const { error } = await searchParams;
  return typeof error === "string" && isAuthError(error) ? <FormMessage message={auth.errors[error]} /> : null;
}
