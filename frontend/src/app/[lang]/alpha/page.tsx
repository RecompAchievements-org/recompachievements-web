import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { localeAlternates, localizePath } from "@/i18n/config";
import { rich } from "@/i18n/rich";
import { getLocale, getMessages } from "@/i18n/server";
import { AlphaSignupForm } from "./AlphaSignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { alpha } = await getMessages();
  return {
    title: alpha.metaTitle,
    description: alpha.metaDescription,
    alternates: localeAlternates(locale, "/alpha"),
  };
}

export default async function AlphaPage() {
  const locale = await getLocale();
  const { alpha } = await getMessages();
  const privacyHref = localizePath(locale, "/privacy");

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:py-24">
      <section className="flex flex-col gap-6">
        <Badge tone="accent" className="self-start">
          {alpha.badge}
        </Badge>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{alpha.title}</h1>
        <p className="text-lg leading-relaxed text-muted">{alpha.intro}</p>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">{alpha.testersHeading}</h2>
          <ul className="flex flex-col gap-2 text-muted">
            {alpha.testers.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="text-gold">★</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">{alpha.storeHeading}</h2>
          <p className="text-muted">
            {rich(alpha.store, {
              privacy: (
                <a href={privacyHref} className="text-accent underline hover:text-accent-strong">
                  {alpha.privacyLink}
                </a>
              ),
            })}
          </p>
        </div>
      </section>

      <Card className="self-start p-6">
        <AlphaSignupForm
          locale={locale}
          privacyHref={privacyHref}
          challengeSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
          messages={alpha}
        />
      </Card>
    </div>
  );
}
