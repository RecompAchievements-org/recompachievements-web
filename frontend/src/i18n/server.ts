import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import type en from "./messages/en.json";
import { isLocale, type Locale } from "./config";

// English is the source of truth: every other dictionary must have the same keys.
export type Messages = typeof en;

/** Each loader is typed as Messages, so a key missing from es.json or pt.json
 *  fails type checking (and therefore `npm run build`).
**/
const loaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("./messages/en.json").then((module) => module.default),
  es: () => import("./messages/es.json").then((module) => module.default),
  pt: () => import("./messages/pt.json").then((module) => module.default),
};

// The current request's locale, read from the [lang] root segment.
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getMessages(): Promise<Messages> {
  return loadMessages(await getLocale());
}

/** Messages for an explicit locale. Use this only where `next/root-params` is unavailable
 *  (Route Handlers such as opengraph-image, Server Actions); elsewhere use getMessages().
**/
export function loadMessages(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}
