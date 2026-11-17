"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  htmlLang,
  localeCookie,
  localeCookieMaxAge,
  localeNames,
  localizePath,
  locales,
  stripLocale,
  type Locale,
} from "@/i18n/config";
import { cx } from "@/lib/cx";

interface LocaleSwitcherProps {
  current: Locale;
  /** Accessible name of the toggle button, already translated ("Change language, current: English"). **/
  buttonLabel: string;
  /** Translated heading for the menu ("Language"). **/
  menuLabel: string;
}

function saveLocale(locale: Locale) {
  document.cookie = `${localeCookie}=${locale}; path=/; max-age=${localeCookieMaxAge}; samesite=lax`;
}

export function LocaleSwitcher({ current, buttonLabel, menuLabel }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const { path } = stripLocale(pathname);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-1 rounded-md px-2 font-mono text-sm text-muted uppercase transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        {current}
        <svg viewBox="0 0 12 12" aria-hidden="true" className={cx("size-3", open && "rotate-180")}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 mt-2 w-44 rounded-lg border border-border-strong bg-surface-raised p-1 shadow-lg"
        >
          <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
            {menuLabel}
          </p>
          <ul>
            {locales.map((locale) => (
              <li key={locale}>
                <Link
                  href={localizePath(locale, path)}
                  lang={htmlLang[locale]}
                  hrefLang={htmlLang[locale]}
                  aria-current={locale === current ? "true" : undefined}
                  onClick={() => {
                    saveLocale(locale);
                    setOpen(false);
                  }}
                  className={cx(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface",
                    locale === current ? "text-accent" : "text-foreground",
                  )}
                >
                  {localeNames[locale]}
                  <span className="font-mono text-xs text-subtle uppercase">{locale}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
