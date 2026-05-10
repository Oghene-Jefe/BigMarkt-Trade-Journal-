// Validates a /v5/user/query-api response. Two layers of defence:
//
//   1. readOnly === 1 must hold. This is Bybit's primary read-only flag —
//      with it set, the key cannot make state-changing API calls regardless
//      of which permission groups appear.
//
//   2. Permission VALUES that allow fund movement are rejected even when
//      readOnly === 1. This is paranoid defence-in-depth: if Bybit ever
//      regresses the readOnly flag, or if a future API path bypasses it,
//      we still don't hold a credential that could move money.
//
// Read scopes (Position, Order, ContractTrade, SpotTrade, etc.) are
// allowed — Bybit's history endpoints require them. We only deny the
// money-movement values. Permission GROUPS we don't recognise also
// trigger rejection so that any new Bybit feature requires a code review
// before connect succeeds.

import type { BybitKeyInfo } from "../types";

const KNOWN_GROUPS = new Set([
  "ContractTrade",
  "Spot",
  "Wallet",
  "Options",
  "Derivatives",
  "Exchange",
  "NFT",
  "CopyTrading",
  "BlockTrade",
  "Earn",
]);

const FUND_MOVEMENT_VALUES = new Set([
  "Withdraw",
  "AccountTransfer",
  "SubMemberTransfer",
  "InternalTransfer",
  "MasterTransfer",
  "UniversalTransfer",
]);

export type ValidationOk = { ok: true; info: BybitKeyInfo };
export type ValidationFail = { ok: false; reason: string };
export type ValidationResult = ValidationOk | ValidationFail;

export function validateBybitKey(info: BybitKeyInfo): ValidationResult {
  if (info.readOnly !== 1) {
    return {
      ok: false,
      reason:
        `API key must be read-only (Bybit reports readOnly=${info.readOnly}). ` +
        `Create a read-only key in Bybit → API Management.`,
    };
  }

  for (const [group, values] of Object.entries(info.permissions ?? {})) {
    if (!KNOWN_GROUPS.has(group)) {
      return {
        ok: false,
        reason:
          `Unsupported Bybit permission group "${group}". This may be a new ` +
          `Bybit feature; please contact BigMarkt support so we can review it ` +
          `before connecting.`,
      };
    }
    for (const v of values ?? []) {
      if (FUND_MOVEMENT_VALUES.has(v)) {
        return {
          ok: false,
          reason:
            `Permission "${v}" (in group "${group}") allows fund movement. ` +
            `BigMarkt requires a key with no withdraw/transfer scope. ` +
            `Create a fresh key without these permissions.`,
        };
      }
    }
  }

  return { ok: true, info };
}
