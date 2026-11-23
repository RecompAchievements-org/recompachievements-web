import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getCurrentAccount } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  return { title: auth.account.metaTitle, robots: { index: false, follow: false } };
}

// "My account": sends signed-in players to their public profile, and everyone else to sign in.
export default async function AccountPage() {
  const { auth } = await getMessages();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<p role="status" className="text-muted">{auth.account.loading}</p>}>
        <GoToProfile />
      </Suspense>
    </div>
  );
}

async function GoToProfile(): Promise<null> {
  const locale = await getLocale();
  const account = await getCurrentAccount();
  redirect(localizePath(locale, account ? `/account/${account.username}` : "/sign-in"));
}
