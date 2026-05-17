const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://*.bigmarkt.co https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  // HSTS — 2-year max-age, subdomain coverage, preload-list ready.
  // Closes the gap codex's hardening checklist itself lists as required
  // (SECURITY_HARDENING_CHECKLIST.md "Header Target") but which wasn't
  // shipped in commit 66638d8. Without HSTS, first-hit MITM downgrade
  // is still possible for journal.bigmarkt.co.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "serial=()",
    ].join(", "),
  },
];

// Server Actions in Next 14+ enforce an origin check that rejects
// requests where the Origin header doesn't match the host. Custom
// domains + Vercel edge can produce a mismatch (x-forwarded-host vs
// host) and surface as HTTP 403 on form submit. Allow-list our
// production + preview origins explicitly.
//
// IMPORTANT: `*.vercel.app` is ONLY allowed outside production. Without
// this guard, every state-changing server action in the app (delete
// trade, revoke EA token, balance reset, admin purge, etc.) is callable
// as drive-by CSRF from any free Vercel deployment — Supabase auth
// cookies default to SameSite=Lax which permits the cross-site POST.
// This closes audit finding H-1 in docs/security-audit-2026-05-17.md.
const allowedOrigins = ["journal.bigmarkt.co", "localhost:3000"];
if (process.env.VERCEL_ENV !== "production") {
  allowedOrigins.push("*.vercel.app");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};
export default nextConfig;
