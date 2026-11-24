import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { cx } from "@/lib/cx";

/** The country flag shown for each site language, matching its regional setting: United States,
 *  Spain, and Brazil. Drawn inline so it looks the same on every system (Windows has no emoji
 *  flags). Decorative: the language name is always the accessible text.
**/
const flags: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <path d="M0 0h24v1.23H0zM0 2.46h24v1.23H0zM0 4.92h24v1.23H0zM0 7.38h24v1.23H0zM0 9.85h24v1.23H0zM0 12.31h24v1.23H0zM0 14.77h24V16H0z" fill="#b22234" />
      <rect width="10.5" height="8.62" fill="#3c3b6e" />
      <path d="M1.7 1.6h.9v.9h-.9zM4.8 1.6h.9v.9h-.9zM7.9 1.6h.9v.9h-.9zM3.2 3.8h.9v.9h-.9zM6.4 3.8h.9v.9h-.9zM1.7 6h.9v.9h-.9zM4.8 6h.9v.9h-.9zM7.9 6h.9v.9h-.9z" fill="#fff" />
    </>
  ),
  es: (
    <>
      <rect width="24" height="16" fill="#aa151b" />
      <rect y="4" width="24" height="8" fill="#f1bf00" />
    </>
  ),
  pt: (
    <>
      <rect width="24" height="16" fill="#009b3a" />
      <path d="M12 1.8 22 8 12 14.2 2 8z" fill="#fedf00" />
      <circle cx="12" cy="8" r="3.6" fill="#002776" />
      <path d="M8.55 7.1c2.4-.3 4.9.3 6.85 1.7" fill="none" stroke="#fff" strokeWidth=".6" />
    </>
  ),
};

export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className={cx("h-3 w-4.5 shrink-0 rounded-[2px] sm:h-3.5 sm:w-5", className)}>
      {flags[locale]}
    </svg>
  );
}
