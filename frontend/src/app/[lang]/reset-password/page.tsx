import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  // Personal one-off links: keep them out of search results.
  return { title: auth.resetPassword.metaTitle, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/[lang]/reset-password">) {
  const { auth } = await getMessages();

  return (
    <AuthShell title={auth.resetPassword.title} intro={auth.resetPassword.intro}>
      <Suspense>
        <ResetPanel searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ResetPanel({ searchParams }: Pick<PageProps<"/[lang]/reset-password">, "searchParams">) {
  const locale = await getLocale();
  const { auth } = await getMessages();
  const { token } = await searchParams;

  return (
    <ResetPasswordForm
      token={typeof token === "string" ? token : ""}
      signInHref={localizePath(locale, "/sign-in")}
      forgotHref={localizePath(locale, "/forgot-password")}
      messages={auth}
    />
  );
}
