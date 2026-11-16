import { htmlLang, type Locale } from "./config";

export type PluralForms = { one: string; other: string } & Partial<
  Record<"zero" | "two" | "few" | "many", string>
>;

// Replace {name} placeholders with values; unknown placeholders are left as-is.
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

// Pick the plural form for a count and fill in {count}.
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(htmlLang[locale]).select(count) as keyof PluralForms;
  const template = forms[category] ?? forms.other;
  return interpolate(template, { count: formatNumber(locale, count) });
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(htmlLang[locale]).format(value);
}

// Format a 0–100 value as a percentage with one decimal ("4.2%", "4,2 %").
export function formatPercent(locale: Locale, value: number): string {
  return new Intl.NumberFormat(htmlLang[locale], {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatDate(
  locale: Locale,
  date: Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(htmlLang[locale], options).format(date);
}
