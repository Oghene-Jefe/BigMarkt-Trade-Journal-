/**
 * BigMarkt Bybit egress proxy.
 *
 * Required Worker secret:
 *   BYBIT_PROXY_TOKEN
 *
 * Vercel env:
 *   BYBIT_MAINNET_BASE_URL=https://<worker>/mainnet
 *   BYBIT_TESTNET_BASE_URL=https://<worker>/testnet
 *   BYBIT_PROXY_TOKEN=<same secret>
 */
const BYBIT_HOSTS = {
  mainnet: "https://api.bybit.com",
  testnet: "https://api-testnet.bybit.com",
};

const FORWARDED_HEADERS = [
  "X-BAPI-API-KEY",
  "X-BAPI-TIMESTAMP",
  "X-BAPI-RECV-WINDOW",
  "X-BAPI-SIGN",
  "User-Agent",
];

export default {
  async fetch(request, env) {
    if (request.method !== "GET") {
      return new Response("method not allowed", { status: 405 });
    }

    const token = request.headers.get("X-BIGMARKT-PROXY-TOKEN");
    if (!env.BYBIT_PROXY_TOKEN || token !== env.BYBIT_PROXY_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }

    const incoming = new URL(request.url);
    const [, environment, ...pathParts] = incoming.pathname.split("/");
    const base = BYBIT_HOSTS[environment];
    if (!base || pathParts.length === 0 || pathParts[0] !== "v5") {
      return new Response("bad proxy path", { status: 400 });
    }

    const target = new URL(`/${pathParts.join("/")}${incoming.search}`, base);
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstream = await fetch(target, {
      method: "GET",
      headers,
      cf: { cacheTtl: 0, cacheEverything: false },
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/json");
    responseHeaders.set("Cache-Control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};
