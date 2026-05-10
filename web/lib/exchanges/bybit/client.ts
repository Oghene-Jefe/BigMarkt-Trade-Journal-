// Thin Bybit V5 REST client. Implements the three endpoints we need for
// the MVP (validate API key, list closed-PnL rows, list fill executions).
// Uses the signing helper for HMAC headers and the normalisers for the
// response shapes. No retries, no caching, no rate-limit handling — those
// belong in the calling sync action where they can be coupled to
// exchange_sync_runs state.

import "server-only";
import type {
  BybitCategory,
  BybitClosedPnlRecord,
  BybitExecutionRecord,
  BybitKeyInfo,
  ExchangeCredentials,
  ExchangeEnvironment,
} from "../types";
import { signBybitRequest, bybitBaseUrl } from "./signing";
import { normalizeClosedPnl, normalizeExecution } from "./normalize";

export class BybitApiError extends Error {
  retCode: number;
  retMsg: string;
  constructor(retCode: number, retMsg: string) {
    super(`Bybit ${retCode}: ${retMsg}`);
    this.name = "BybitApiError";
    this.retCode = retCode;
    this.retMsg = retMsg;
  }
}

export class BybitHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Bybit HTTP ${status}: ${message}`);
    this.name = "BybitHttpError";
    this.status = status;
  }
}

type BybitEnvelope<T> = {
  retCode: number;
  retMsg: string;
  result: T;
  retExtInfo?: unknown;
  time?: number;
};

async function call<T>(
  creds: ExchangeCredentials,
  env: ExchangeEnvironment,
  path: string,
  query: Record<string, string | number | undefined | null> = {},
): Promise<T> {
  const { url, headers } = signBybitRequest({
    apiKey: creds.apiKey,
    apiSecret: creds.apiSecret,
    baseUrl: bybitBaseUrl(env),
    path,
    query,
  });

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new BybitHttpError(res.status, res.statusText || "request failed");
  }
  const json = (await res.json()) as BybitEnvelope<T>;
  if (json.retCode !== 0) {
    throw new BybitApiError(json.retCode, json.retMsg ?? "unknown");
  }
  return json.result;
}

// ---------- /v5/user/query-api ----------------------------------------------

type RawKeyInfo = {
  readOnly: 0 | 1;
  permissions?: Record<string, string[]>;
  ips?: string[];
  userID?: number;
  isMaster?: boolean;
  uta?: number;
  expiredAt?: string;
  parentUid?: string;
  type?: number;
};

export async function queryApiKey(
  creds: ExchangeCredentials,
  env: ExchangeEnvironment,
): Promise<BybitKeyInfo> {
  const result = await call<RawKeyInfo>(creds, env, "/v5/user/query-api");
  return {
    readOnly: result.readOnly,
    permissions: result.permissions ?? {},
    ips: result.ips ?? [],
    userID: result.userID,
    isMaster: result.isMaster,
    uta: result.uta,
    expiredAt: result.expiredAt,
    parentUid: result.parentUid,
    type: result.type,
  };
}

// ---------- /v5/position/closed-pnl -----------------------------------------

export type GetClosedPnlParams = {
  category: BybitCategory;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number; // 1..100, default 50
  cursor?: string;
};

export type ClosedPnlPage = {
  list: BybitClosedPnlRecord[];
  nextPageCursor: string | null;
};

type RawListEnvelope<R> = {
  list?: R[];
  nextPageCursor?: string;
  category?: string;
};

export async function getClosedPnl(
  creds: ExchangeCredentials,
  env: ExchangeEnvironment,
  params: GetClosedPnlParams,
): Promise<ClosedPnlPage> {
  const result = await call<RawListEnvelope<Record<string, unknown>>>(
    creds,
    env,
    "/v5/position/closed-pnl",
    params,
  );
  return {
    list: (result.list ?? []).map(normalizeClosedPnl),
    nextPageCursor: result.nextPageCursor || null,
  };
}

// ---------- /v5/execution/list ----------------------------------------------

export type GetExecutionsParams = {
  category: BybitCategory | "spot" | "option" | "inverse";
  symbol?: string;
  orderId?: string;
  orderLinkId?: string;
  baseCoin?: string;
  settleCoin?: string;
  startTime?: number;
  endTime?: number;
  execType?: string;
  limit?: number;
  cursor?: string;
};

export type ExecutionsPage = {
  list: BybitExecutionRecord[];
  nextPageCursor: string | null;
};

export async function getExecutions(
  creds: ExchangeCredentials,
  env: ExchangeEnvironment,
  params: GetExecutionsParams,
): Promise<ExecutionsPage> {
  const result = await call<RawListEnvelope<Record<string, unknown>>>(
    creds,
    env,
    "/v5/execution/list",
    params,
  );
  return {
    list: (result.list ?? []).map(normalizeExecution),
    nextPageCursor: result.nextPageCursor || null,
  };
}
