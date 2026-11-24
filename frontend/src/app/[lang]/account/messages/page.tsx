import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { SkeletonText } from "@/components/ui/Skeleton";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { getCurrentAccount } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  return { title: auth.messages.metaTitle, robots: { index: false, follow: false } };
}

// A placeholder for messages between players, a future feature. Nothing is sent or stored.
export default async function MessagesPage() {
  const { auth } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{auth.messages.title}</h1>
      <Suspense
        fallback={
          <Card role="status" aria-label={auth.messages.loading} className="flex flex-col gap-2 p-5 sm:p-6">
            <SkeletonText widths={["w-40"]} className="font-display text-xl" />
            <SkeletonText widths={["w-full"]} />
          </Card>
        }
      >
        <ComingSoon />
      </Suspense>
    </div>
  );
}

async function ComingSoon() {
  const locale = await getLocale();
  const { auth } = await getMessages();
  if (!(await getCurrentAccount())) redirect(localizePath(locale, "/sign-in"));

  return (
    <Card className="flex flex-col gap-2 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">{auth.messages.comingSoonTitle}</h2>
      <p className="text-muted">{auth.messages.comingSoonBody}</p>
    </Card>
  );
}
