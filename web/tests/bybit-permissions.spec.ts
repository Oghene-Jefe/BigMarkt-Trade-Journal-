/**
 * Pin the Bybit API-key validator. Two layers: readOnly === 1 must hold,
 * AND no fund-movement permission value may appear, AND no unknown
 * permission group may appear.
 */
import { describe, it, expect } from "vitest";
import { validateBybitKey } from "@/lib/exchanges/bybit/permissions";
import type { BybitKeyInfo } from "@/lib/exchanges/types";

function key(overrides: Partial<BybitKeyInfo> = {}): BybitKeyInfo {
  return {
    readOnly: 1,
    permissions: {},
    ips: [],
    ...overrides,
  };
}

describe("validateBybitKey — primary readOnly gate", () => {
  it("rejects readOnly = 0", () => {
    const r = validateBybitKey(key({ readOnly: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/read-only/i);
  });

  it("accepts readOnly = 1 with empty permissions", () => {
    const r = validateBybitKey(key());
    expect(r.ok).toBe(true);
  });
});

describe("validateBybitKey — fund-movement deny-list", () => {
  it("rejects keys with Withdraw permission", () => {
    const r = validateBybitKey(
      key({ permissions: { Wallet: ["Withdraw"] } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Withdraw/);
  });

  it("rejects AccountTransfer", () => {
    const r = validateBybitKey(
      key({ permissions: { Wallet: ["AccountTransfer"] } }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects SubMemberTransfer", () => {
    const r = validateBybitKey(
      key({ permissions: { Wallet: ["SubMemberTransfer"] } }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects InternalTransfer / MasterTransfer / UniversalTransfer", () => {
    for (const v of ["InternalTransfer", "MasterTransfer", "UniversalTransfer"]) {
      const r = validateBybitKey(key({ permissions: { Wallet: [v] } }));
      expect(r.ok, `value: ${v}`).toBe(false);
    }
  });

  it("allows read scopes that real read-only keys have", () => {
    // Bybit's read-only key for derivatives history typically includes
    // scopes like Position / Order under the ContractTrade group. These
    // are read-only-friendly; rejecting them would break every real key.
    const r = validateBybitKey(
      key({ permissions: { ContractTrade: ["Position", "Order"] } }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("validateBybitKey — group allow-list", () => {
  it("rejects an unknown permission group", () => {
    const r = validateBybitKey(
      key({ permissions: { FutureBybitFeature: [""] } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Unsupported.*FutureBybitFeature/);
  });

  it("accepts every known group with empty values", () => {
    const r = validateBybitKey(
      key({
        permissions: {
          ContractTrade: [],
          Spot: [],
          Wallet: [],
          Options: [],
          Derivatives: [],
          Exchange: [],
          NFT: [],
          CopyTrading: [],
          BlockTrade: [],
          Earn: [],
        },
      }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("validateBybitKey — happy path", () => {
  it("returns the original info on success", () => {
    const input = key({
      ips: ["1.2.3.4"],
      userID: 999,
      isMaster: true,
      uta: 1,
    });
    const r = validateBybitKey(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.info).toBe(input);
  });
});
