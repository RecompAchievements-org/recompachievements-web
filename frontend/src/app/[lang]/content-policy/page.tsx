import type { Metadata } from "next";
import { htmlLang, localeAlternates } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { contentPolicy } = await getMessages();
  return {
    title: contentPolicy.metaTitle,
    description: contentPolicy.metaDescription,
    alternates: localeAlternates(locale, "/content-policy"),
  };
}

// What the site hosts, where game images come from, and how rights holders request removal.
export default async function ContentPolicyPage() {
  const locale = await getLocale();
  const { contentPolicy } = await getMessages();
  const email = (
    <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline hover:text-accent-strong">
      {siteConfig.contactEmail}
    </a>
  );

  return (
    <article lang={htmlLang[locale]} className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-24">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">{contentPolicy.title}</h1>
        <p className="text-lg leading-relaxed text-muted">{contentPolicy.intro}</p>
      </header>

      {contentPolicy.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-muted">{rich(section.body, { email })}</p>
        </section>
      ))}
    </article>
  );
}
