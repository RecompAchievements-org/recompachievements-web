import type { Metadata } from "next";
import { Suspense } from "react";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { ConfirmSignup } from "./ConfirmSignup";

export async function generateMetadata(): Promise<Metadata> {
  const { alphaConfirm } = await getMessages();
  // Personal one-off links: keep them out of search results.
  return { title: alphaConfirm.metaTitle, robots: { index: false, follow: false } };
}

export default async function ConfirmPage({ searchParams }: PageProps<"/[lang]/alpha/confirm">) {
  const { alphaConfirm } = await getMessages();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{alphaConfirm.title}</h1>
      {/** The token comes from the URL, which is only known per request; the heading above
       *  stays in the prerendered shell.
      **/}
      <Suspense>
        <ConfirmPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ConfirmPanel({ searchParams }: Pick<PageProps<"/[lang]/alpha/confirm">, "searchParams">) {
  const locale = await getLocale();
  const { alphaConfirm } = await getMessages();
  const { token } = await searchParams;

  return (
    <ConfirmSignup
      token={typeof token === "string" ? token : ""}
      signUpHref={localizePath(locale, "/alpha")}
      homeHref={localizePath(locale, "/")}
      messages={alphaConfirm}
    />
  );
}
