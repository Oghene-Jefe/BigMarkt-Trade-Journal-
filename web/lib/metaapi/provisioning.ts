// WRITE-SCOPED MetaApi PROVISIONING client.
//
// This module talks to the MetaApi Provisioning REST API
// (https://metaapi.cloud/docs/provisioning/) to CREATE, ENABLE MetaStats on,
// DEPLOY, and READ the state of a cloud MT5 account. It runs with the
// write-scoped METAAPI_PROVISIONING_TOKEN and must be called ONLY from server
// actions / cron — never the client.
//
// HARD RULE — this file provisions ACCOUNTS. It must never place, modify, or
// close a trade. There is no MetaApi SDK imported and no trading/order/position
// endpoint here. Account creation uses the broker INVESTOR (read-only) password
// and magic=0; the account can read its own history but cannot trade.
//
// Structured results (never throw) so the fire-and-poll orchestrator and the
// cron can branch on outcome. MetaApi BILLS for excessive bad requests, so we
// retry ONLY transient failures (429 / 5xx / network) — never 400/401/403/404.

import "server-only";

const PROVISIONING_HOST =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── result type ──────────────────────────────────────────────────────────────
export type ProvisioningResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; body?: unknown };

// ── token ────────────────────────────────────────────────────────────────────
function provisioningToken(): string {
  const t = process.env.METAAPI_PROVISIONING_TOKEN;
  if (!t) {
    throw new Error(
      "METAAPI_PROVISIONING_TOKEN is not set. Add a WRITE-scoped MetaApi token " +
        "(provisioning only) to the server env (Vercel Production + Preview).",
    );
  }
  return t;
}

// ── documented shapes ─────────────────────────────────────────────────────────
export type TradingAccountState =
  | "CREATED"
  | "DEPLOYING"
  | "DEPLOYED"
  | "DEPLOY_FAILED"
  | "UNDEPLOYING"
  | "UNDEPLOYED"
  | "DELETING"
  | (string & {});

export type TradingAccountConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "DISCONNECTED_FROM_BROKER"
  | (string & {});

export type TradingAccount = {
  _id: string;
  login?: string;
  name?: string;
  server?: string;
  region?: string;
  state?: TradingAccountState;
  connectionStatus?: TradingAccountConnectionStatus;
  metastatsApiEnabled?: boolean;
  [k: string]: unknown;
};

/** Broker -> server-name[] map, as returned by known-mt-servers search. */
export type KnownTradingServers = Record<string, string[]>;

// ── core request ──────────────────────────────────────────────────────────────
// One place all provisioning requests flow through. `expect204` marks endpoints
// whose success body is empty (deploy, enable-features).
async function provisioningRequest<T>(args: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  expect204?: boolean;
  shape?: (json: unknown) => T;
}): Promise<ProvisioningResult<T>> {
  const url = `${PROVISIONING_HOST}${args.path}`;
  let lastError = "unknown error";
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: args.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "auth-token": provisioningToken(),
        },
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.ok) {
        if (args.expect204 || res.status === 204) {
          return { ok: true, data: undefined as unknown as T };
        }
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          return { ok: false, status: res.status, error: "Malformed JSON response" };
        }
        return { ok: true, data: args.shape ? args.shape(json) : (json as T) };
      }

      // Non-2xx. Capture the body — MetaApi returns useful detail here
      // (e.g. serversByBrokers suggestions on a bad server, OTP hints).
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      lastStatus = res.status;
      lastError =
        res.status === 400 ? messageFromBody(body) ?? "validation failed (check server/login/password)"
        : res.status === 401 ? "provisioning token invalid or expired"
        : res.status === 403 ? "provisioning token lacks permission for this action"
        : res.status === 404 ? "account or provisioning profile not found"
        : res.status === 429 ? "rate limited"
        : `HTTP ${res.status}`;

      // NEVER blind-retry client errors — MetaApi charges for excessive errors.
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt === MAX_ATTEMPTS) {
        return { ok: false, status: res.status, error: lastError, body };
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

function messageFromBody(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const m = (body as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

// ── public: validate / suggest servers (call BEFORE create) ───────────────────
// version is the MT version number (5 for MT5). Returns broker->servers map;
// empty object means no known match (server may still be valid but unlisted).
export async function searchKnownServers(args: {
  version: number;
  query: string;
}): Promise<ProvisioningResult<KnownTradingServers>> {
  const q = encodeURIComponent(args.query.trim());
  return provisioningRequest<KnownTradingServers>({
    method: "GET",
    path: `/known-mt-servers/${args.version}/search?query=${q}`,
    shape: (json) =>
      json && typeof json === "object" ? (json as KnownTradingServers) : {},
  });
}

// ── public: create account ────────────────────────────────────────────────────
// Uses the INVESTOR (read-only) password + magic=0. Caller DISCARDS the password
// immediately after this returns. Returns the new MetaApi account id only —
// state is fetched separately via readAccount (fire-and-poll).
export async function createAccount(args: {
  login: string;
  investorPassword: string;
  server: string;
  name: string;
  // Optional — omit to let MetaApi auto-detect the broker from the server name
  // (the default; a manual provisioning profile is only needed for unusual brokers).
  provisioningProfileId?: string;
}): Promise<ProvisioningResult<{ id: string }>> {
  const body: Record<string, unknown> = {
    login: args.login,
    password: args.investorPassword,
    name: args.name,
    server: args.server,
    platform: "mt5",
    magic: 0,
    application: "MetaApi",
    type: "cloud-g2",
    reliability: "regular",
    manualTrades: false,
  };
  if (args.provisioningProfileId) body.provisioningProfileId = args.provisioningProfileId;
  return provisioningRequest<{ id: string }>({
    method: "POST",
    path: `/users/current/accounts`,
    body,
    shape: (json) => {
      const id = (json as Record<string, unknown>)?.id;
      if (typeof id !== "string") throw new Error("create response missing id");
      return { id };
    },
  });
}

// ── public: enable MetaStats (paid; briefly stops the account) ─────────────────
export async function enableMetaStats(
  accountId: string,
): Promise<ProvisioningResult<void>> {
  return provisioningRequest<void>({
    method: "POST",
    path: `/users/current/accounts/${encodeURIComponent(accountId)}/enable-account-features`,
    body: { metastatsApiEnabled: true },
    expect204: true,
  });
}

// ── public: deploy (idempotent — ignored if already deployed) ──────────────────
export async function deployAccount(
  accountId: string,
): Promise<ProvisioningResult<void>> {
  return provisioningRequest<void>({
    method: "POST",
    path: `/users/current/accounts/${encodeURIComponent(accountId)}/deploy`,
    expect204: true,
  });
}

// ── public: undeploy (idempotent — stops the API server + terminal to save
//    hosting cost; ignored if already undeployed). Read-only capture is
//    unaffected — this only controls whether the cloud server is running. ──
export async function undeployAccount(
  accountId: string,
): Promise<ProvisioningResult<void>> {
  return provisioningRequest<void>({
    method: "POST",
    path: `/users/current/accounts/${encodeURIComponent(accountId)}/undeploy`,
    expect204: true,
  });
}

// ── public: read account (fire-and-poll state source) ─────────────────────────
export async function readAccount(
  accountId: string,
): Promise<ProvisioningResult<TradingAccount>> {
  return provisioningRequest<TradingAccount>({
    method: "GET",
    path: `/users/current/accounts/${encodeURIComponent(accountId)}`,
    shape: (json) => json as TradingAccount,
  });
}
