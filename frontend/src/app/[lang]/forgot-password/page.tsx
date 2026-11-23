import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { localeAlternates, localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { auth } = await getMessages();
  return {
    title: auth.forgotPassword.metaTitle,
    alternates: localeAlternates(locale, "/forgot-password"),
    robots: { index: false, follow: true },
  };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const { auth } = await getMessages();

  return (
    <AuthShell title={auth.forgotPassword.title} intro={auth.forgotPassword.intro}>
      <ForgotPasswordForm
        locale={locale}
        challengeSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        signInHref={localizePath(locale, "/sign-in")}
        messages={auth}
      />
    </AuthShell>
  );
}
