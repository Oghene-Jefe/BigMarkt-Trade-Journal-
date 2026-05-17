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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Server Actions in Next 14+ enforce an origin check that rejects
  // requests where the Origin header doesn't match the host. Custom
  // domains + Vercel edge can produce a mismatch (x-forwarded-host vs
  // host) and surface as HTTP 403 on form submit. Allow-list our
  // production + preview origins explicitly.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "journal.bigmarkt.co",
        "*.vercel.app",
        "localhost:3000",
      ],
    },
  },
};
export default nextConfig;
