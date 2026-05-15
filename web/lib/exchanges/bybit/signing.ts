// Bybit V5 request signing.
//
// Per Bybit docs, every authenticated REST request needs four headers:
//   X-BAPI-API-KEY      the API key
//   X-BAPI-TIMESTAMP    millisecond UNIX timestamp at request time
//   X-BAPI-RECV-WINDOW  ms tolerance Bybit allows between request and arrival
//   X-BAPI-SIGN         HMAC-SHA256(secret, timestamp + apiKey + recvWindow + body)
//
// For GET requests `body` is the query string exactly as it appears in the
// URL. We standardise canonicalization here (URLSearchParams iteration order)
// so the string we sign matches the string we send — Bybit cares about that
// equivalence, not about alphabetical sorting.

import "server-only";
import { createHmac } from "node:crypto";
import type { ExchangeEnvironment } from "../types";

export type SignedRequest = {
  url: string;
  headers: Record<string, string>;
};

export type SignBybitInput = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  path: string;
  query?: Record<string, string | number | undefined | null>;
  /** Defaults to 5000 (Bybit's documented default). */
  recvWindow?: number;
  /** Injectable for deterministic tests. Defaults to Date.now(). */
  timestamp?: number;
};

export function buildBybitQueryString(
  query: Record<string, string | number | undefined | null> = {},
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    // Drop undefined / null / empty strings; Bybit treats absent and empty
    // differently for some endpoints, and we want absent for those cases.
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

export function bybitBaseUrl(env: ExchangeEnvironment): string {
  const override =
    env === "testnet"
      ? process.env.BYBIT_TESTNET_BASE_URL
      : process.env.BYBIT_MAINNET_BASE_URL;
  if (override) return override.replace(/\/+$/, "");
  return env === "testnet" ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
}

export function signBybitRequest(input: SignBybitInput): SignedRequest {
  if (!input.apiKey) throw new Error("signBybitRequest: apiKey is required");
  if (!input.apiSecret) throw new Error("signBybitRequest: apiSecret is required");

  const recvWindow = String(input.recvWindow ?? 5000);
  const timestamp = String(input.timestamp ?? Date.now());
  const queryString = buildBybitQueryString(input.query);

  const payload = timestamp + input.apiKey + recvWindow + queryString;
  const signature = createHmac("sha256", input.apiSecret).update(payload).digest("hex");

  const url = queryString
    ? `${input.baseUrl}${input.path}?${queryString}`
    : `${input.baseUrl}${input.path}`;

  return {
    url,
    headers: {
      "X-BAPI-API-KEY": input.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "X-BAPI-SIGN": signature,
    },
  };
}
