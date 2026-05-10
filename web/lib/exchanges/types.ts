// Shared types for the Bybit (and future) exchange adapters. Kept in one
// place so client + server + tests don't drift from the DB-row shape.

export type ExchangeId = "bybit";
export type BybitCategory = "linear"; // MVP scope; "inverse" / "spot" later
export type ExchangeEnvironment = "mainnet" | "testnet";

// In-memory only — never logged, never persisted in the clear.
export type ExchangeCredentials = {
  apiKey: string;
  apiSecret: string;
};

// Bybit /v5/user/query-api response shape (subset we care about).
export type BybitKeyInfo = {
  readOnly: 0 | 1;
  permissions: Record<string, string[]>;
  ips: string[];
  userID?: number;
  isMaster?: boolean;
  uta?: number;
  expiredAt?: string;
  parentUid?: string;
  type?: number;
};

// Normalised closed-PnL record. Numbers are converted; raw payload is kept
// for forensic purposes if Bybit changes a field shape later.
export type BybitClosedPnlRecord = {
  symbol: string;
  orderId: string;
  side: "Buy" | "Sell";
  qty: number | null;
  closedSize: number | null;
  avgEntryPrice: number | null;
  avgExitPrice: number | null;
  closedPnl: number | null;
  openFee: number | null;
  closeFee: number | null;
  leverage: number | null;
  orderType: string | null;
  execType: string | null;
  createdAt: string; // ISO from Bybit ms timestamp
  closedAt: string;  // ISO from Bybit updatedTime ms
  raw: unknown;
};

// Normalised /v5/execution/list record.
export type BybitExecutionRecord = {
  symbol: string;
  orderId: string;
  orderLinkId: string | null;
  side: "Buy" | "Sell";
  orderPrice: number | null;
  orderQty: number | null;
  execPrice: number | null;
  execQty: number | null;
  execValue: number | null;
  execFee: number | null;
  feeRate: number | null;
  feeCurrency: string | null;
  execType: string | null;
  isMaker: boolean;
  closedSize: number | null;
  seq: string | null;
  execId: string;
  executedAt: string; // ISO from Bybit execTime ms
  raw: unknown;
};

// On-disk encrypted blob. Stored as a JSON string in
// exchange_connections.encrypted_api_key / encrypted_api_secret.
export type EncryptedBlob = {
  v: 1;
  iv: string;  // base64(12 bytes)
  ct: string;  // base64(ciphertext)
  tag: string; // base64(16-byte GCM auth tag)
};

// Sync run states match the DB check constraint.
export type SyncRunStatus = "running" | "success" | "partial" | "failed";

// Connection states match the DB check constraint.
export type ConnectionStatus = "active" | "paused" | "error" | "revoked";

// Closed-PnL import workflow states.
export type ImportStatus = "pending" | "approved" | "ignored" | "imported" | "error";
