import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { EmailRequiredBanner } from "@/components/layout/EmailRequiredBanner";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { htmlLang, locales, openGraphLocale } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";
import { fontVariables } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const messages = await getMessages();

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s · ${siteConfig.name}`,
    },
    description: messages.metadata.description,
    openGraph: {
      siteName: siteConfig.name,
      type: "website",
      locale: openGraphLocale[locale],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0c14",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={htmlLang[locale]}
      className={`${fontVariables} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          {messages.common.skipToContent}
        </a>
        <SiteHeader />
        {/** Only for signed-in accounts without a confirmed email; reads the session per request. **/}
        <Suspense>
          <EmailRequiredBanner />
        </Suspense>
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
