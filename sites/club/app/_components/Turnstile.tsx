"use client";

import Script from "next/script";

// Renders the Cloudflare Turnstile widget if NEXT_PUBLIC_TURNSTILE_SITE_KEY
// is configured at build time. Falls back to a no-op so local dev keeps
// working — the server-side verifier in lib/abuse.ts is also fail-open
// when TURNSTILE_SECRET_KEY is unset, so the two flip together.
export default function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      {/* The widget injects a hidden input named `cf-turnstile-response`
          into the surrounding form — that's the value our server action
          reads and forwards to Cloudflare's siteverify endpoint. */}
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="dark"
      />
    </>
  );
}
