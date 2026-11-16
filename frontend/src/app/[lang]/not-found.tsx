import { ButtonLink } from "@/components/ui/Button";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata() {
  const { notFound } = await getMessages();
  return { title: notFound.metaTitle };
}

export default async function NotFound() {
  const locale = await getLocale();
  const { notFound } = await getMessages();

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="font-display text-4xl font-bold tracking-tight">{notFound.title}</h1>
      <p className="text-lg text-muted">{notFound.description}</p>
      <ButtonLink href={localizePath(locale, "/")} variant="secondary">
        {notFound.backHome}
      </ButtonLink>
    </div>
  );
}
