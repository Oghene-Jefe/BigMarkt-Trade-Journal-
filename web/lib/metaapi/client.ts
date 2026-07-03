// READ-ONLY MetaStats REST client.
//
// This module talks to the MetaStats REST API (https://metaapi.cloud/docs/metastats/)
// to pull a broker account's CLOSED and OPEN trades for journaling. It is the
// MetaApi analogue of the read-only MQL5 EA: it captures data, it NEVER acts.
//
// HARD RULE — this file must contain GET requests ONLY. No POST/PUT/PATCH/DELETE,
// no trade/order/position mutation, ever. MetaApi's full SDK exposes execution
// methods; we deliberately do NOT import it, so no execution capability exists in
// this code path at all. If a future change needs to write to MetaApi, it does
// NOT belong in this file.
//
// The caller passes an ALREADY-DECRYPTED reader token (see web/lib/metaapi/
// secrets.ts). Encryption never happens here — this module is pure HTTP.

import "server-only";

// ── documented response shapes ───────────────────────────────────────────────
// Fields per https://metaapi.cloud/docs/metastats/models/ . Uncertain-presence
// fields are optional; an index signature preserves any undocumented extras so
// the normalize step (piece 2) can fall back to raw values if needed.

export type MetaStatsHistoricalTrade = {
  _id: string;
  accountId: string;
  // Present on open trades; MAY be present on closed trades (not shown in the
  // minimal docs example). Optional so the type is honest; piece 2 decides the
  // keying strategy once confirmed against a live account.
  positionId?: string;
  volume: number;
  durationInMinutes?: number;
  profit: number;
  gain?: number;
  success?: string;               // "won" | "lost"
  openTime: string;               // "YYYY-MM-DD HH:mm:ss.SSS"
  closeTime?: string;
  type: string;                   // "DEAL_TYPE_BUY" | "DEAL_TYPE_SELL" | ...
  symbol: string;
  openPrice?: number;
  closePrice?: number;
  pips?: number;
  [k: string]: unknown;
};

export type MetaStatsOpenTrade = {
  _id: string;
  accountId: string;
  positionId: string;
  volume: number;
  profit: number;
  success?: string;
  openTime: string;
  type: string;                   // "POSITION_TYPE_BUY" | "POSITION_TYPE_SELL"
  symbol: string;
  openPrice: number;
  durationInMinutes?: number;
  gain?: number;
  pips?: number;
  [k: string]: unknown;
};

// ── result type ──────────────────────────────────────────────────────────────
// Structured instead of throwing, so the cron can log per-connection failures
// and keep going. status 0 = network/timeout (no HTTP response).

export type MetaStatsResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

// ── config ───────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/** Region-scoped MetaStats host. region is stored per-connection (e.g.
 *  "new-york", "london") and assigned by MetaApi at provisioning time. */
function metaStatsHost(region: string): string {
  const r = region.trim();
  if (!r) throw new Error("metaapi/client: region is required");
  return `https://metastats-api-v1.${r}.agiliumtrade.ai`;
}

/** MetaStats path timestamps use "YYYY-MM-DD HH:mm:ss.SSS" in UTC (space, not
 *  ISO 'T'; milliseconds). Each segment is URL-encoded by the caller. */
export function formatMetaStatsTime(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
    `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}.` +
    `${p(date.getUTCMilliseconds(), 3)}`
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── core GET ─────────────────────────────────────────────────────────────────
// Single place all MetaStats requests flow through. Timeout via AbortController,
// retry on 429 / 5xx / network error, documented error-code mapping. Accepts a
// generic shaper so each endpoint can normalise its wrapper (see below).

async function metaStatsGet<T>(args: {
  url: string;
  token: string;
  shape: (json: unknown) => T;
}): Promise<MetaStatsResult<T>> {
  let lastError = "unknown error";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(args.url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "auth-token": args.token,
        },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.ok) {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          return { ok: false, status: res.status, error: "Malformed JSON response" };
        }
        return { ok: true, data: args.shape(json) };
      }

      // Non-2xx. Map the documented codes to readable errors.
      lastStatus = res.status;
      lastError =
        res.status === 401 ? "auth-token invalid or expired"
        : res.status === 403 ? "MetaStats API not enabled on this account"
        : res.status === 404 ? "account not found or not provisioned yet"
        : res.status === 429 ? "rate limited"
        : `HTTP ${res.status}`;

      // Retry only transient failures; auth/enablement/not-found won't fix on retry.
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt === MAX_ATTEMPTS) {
        return { ok: false, status: res.status, error: lastError };
      }
    } catch (err) {
      clearTimeout(timer);
      lastStatus = 0;
      lastError =
        err instanceof Error && err.name === "AbortError"
          ? `request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : err instanceof Error ? err.message : "network error";
      if (attempt === MAX_ATTEMPTS) {
        return { ok: false, status: 0, error: lastError };
      }
    }

    await sleep(RETRY_BASE_DELAY_MS * attempt);
  }

  return { ok: false, status: lastStatus, error: lastError };
}

// ── array coercion ───────────────────────────────────────────────────────────
// The open-trades response wraps in `openTrades`. The historical-trades wrapper
// key is not shown in the docs, so accept either a bare array or a { <key>: [] }
// object. Defensive on purpose — costs nothing, survives either shape.
function coerceArray(json: unknown, keys: string[]): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const k of keys) {
      const v = (json as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

// ── public: closed / historical trades ───────────────────────────────────────
// updateHistory=true forces MetaStats to refresh the account's historical data
// before returning, so a poll always sees the latest closes. `from`/`to` bound
// the query window (UTC). Times are URL-encoded per segment.
export async function getHistoricalTrades(args: {
  region: string;
  token: string;
  accountId: string;
  from: Date;
  to: Date;
  updateHistory?: boolean;
}): Promise<MetaStatsResult<MetaStatsHistoricalTrade[]>> {
  const host = metaStatsHost(args.region);
  const start = encodeURIComponent(formatMetaStatsTime(args.from));
  const end = encodeURIComponent(formatMetaStatsTime(args.to));
  const qs = args.updateHistory === false ? "" : "?updateHistory=true";
  const url =
    `${host}/users/current/accounts/${encodeURIComponent(args.accountId)}` +
    `/historical-trades/${start}/${end}${qs}`;

  return metaStatsGet<MetaStatsHistoricalTrade[]>({
    url,
    token: args.token,
    shape: (json) => coerceArray(json, ["trades", "historicalTrades"]) as MetaStatsHistoricalTrade[],
  });
}

// ── public: open trades ──────────────────────────────────────────────────────
export async function getOpenTrades(args: {
  region: string;
  token: string;
  accountId: string;
}): Promise<MetaStatsResult<MetaStatsOpenTrade[]>> {
  const host = metaStatsHost(args.region);
  const url =
    `${host}/users/current/accounts/${encodeURIComponent(args.accountId)}/open-trades`;

  return metaStatsGet<MetaStatsOpenTrade[]>({
    url,
    token: args.token,
    shape: (json) => coerceArray(json, ["openTrades"]) as MetaStatsOpenTrade[],
  });
}
