/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
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
