"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "dark" | "light" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

type Props = {
  /** Called every time Cloudflare hands us a fresh token. */
  onToken: (token: string) => void;
  /** Bump this number after a successful submit to force a re-render. */
  resetKey?: number;
};

/**
 * Web-app Turnstile widget. Render once, capture the cf-turnstile-response
 * token into local state via the `onToken` callback, then the parent passes
 * it into the server action.
 *
 * If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset (local dev), this renders
 * nothing — matches the server-side `verifyTurnstile()` fail-open behavior
 * in dev. In production both env vars MUST be set; the server action will
 * fail-closed and reject the submission if `TURNSTILE_SECRET_KEY` is missing.
 */
export default function Turnstile({ onToken, resetKey = 0 }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  // Render / re-render on mount, when the script loads, or when `resetKey`
  // bumps (used after a successful submit so the user can submit again).
  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return;

    // Tear down any previous instance before re-rendering.
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, scriptReady, resetKey, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
