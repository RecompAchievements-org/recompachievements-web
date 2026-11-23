import type { Metadata } from "next";
import { htmlLang, localeAlternates } from "@/i18n/config";
import { formatDate, interpolate } from "@/i18n/format";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

// Update when the notice's content changes.
const lastUpdated = new Date("2026-11-23T00:00:00Z");

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { privacy } = await getMessages();
  return { title: privacy.metaTitle, alternates: localeAlternates(locale, "/privacy") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const { privacy } = await getMessages();
  const email = (
    <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline hover:text-accent-strong">
      {siteConfig.contactEmail}
    </a>
  );

  return (
    <article lang={htmlLang[locale]} className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-24">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">{privacy.title}</h1>
        <p className="text-sm text-subtle">
          {interpolate(privacy.updated, { date: formatDate(locale, lastUpdated, { dateStyle: "long", timeZone: "UTC" }) })}
        </p>
        <p className="text-lg leading-relaxed text-muted">{privacy.intro}</p>
      </header>

      {privacy.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold">{section.title}</h2>
          <p className="leading-relaxed text-muted">{rich(section.body, { email })}</p>
        </section>
      ))}
    </article>
  );
}
