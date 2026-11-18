"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { htmlLang, type Locale } from "@/i18n/config";

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface HumanCheckProps {
  siteKey: string;
  action: string;
  locale: Locale;
  // Receives the one-time token when the check passes, and null when it expires or fails.
  onToken: (token: string | null) => void;
}

/** The "verify you are human" box shown above the submit button. It renders explicitly (so it
 *  works again when the form remounts after a failed attempt) and reports its single-use token to
 *  the form, which sends it to the server for verification.
**/
export function HumanCheck({ siteKey, action, locale, onToken }: HumanCheckProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    // Runs again once the script is ready; on later visits the script is already loaded.
    const api = window.turnstile;
    const container = containerRef.current;
    if (!container || !api) return;

    const widgetId = api.render(container, {
      sitekey: siteKey,
      action,
      theme: "dark",
      // The full-size box needs 300px; narrow phones get the compact square version instead.
      size: container.clientWidth < 300 ? "compact" : "flexible",
      language: htmlLang[locale].toLowerCase(),
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });

    return () => api.remove(widgetId);
  }, [scriptReady, siteKey, action, locale]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  );
}
