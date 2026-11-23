import type { Metadata } from "next";
import { Suspense } from "react";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { ConfirmEmail } from "./ConfirmEmail";

export async function generateMetadata(): Promise<Metadata> {
  const { auth } = await getMessages();
  // Personal one-off links: keep them out of search results.
  return { title: auth.confirmEmail.metaTitle, robots: { index: false, follow: false } };
}

export default async function ConfirmEmailPage({ searchParams }: PageProps<"/[lang]/confirm-email">) {
  const { auth } = await getMessages();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{auth.confirmEmail.title}</h1>
      {/** The token comes from the URL, known only per request; the heading stays in the static shell. **/}
      <Suspense>
        <ConfirmPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ConfirmPanel({ searchParams }: Pick<PageProps<"/[lang]/confirm-email">, "searchParams">) {
  const locale = await getLocale();
  const { auth } = await getMessages();
  const { token } = await searchParams;

  return (
    <ConfirmEmail
      token={typeof token === "string" ? token : ""}
      continueHref={localizePath(locale, "/account")}
      messages={auth}
    />
  );
}
