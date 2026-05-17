import { describe, expect, it } from "vitest";
import { buildEaTradeRow, deriveEaDirection, deriveEaResult, eaTradeSchema } from "@/lib/ea/normalize";

describe("EA trade normalization", () => {
  it("maps MT buy/sell types to DB direction enum values", () => {
    expect(deriveEaDirection("buy")).toBe("BUY");
    expect(deriveEaDirection("BUY_LIMIT")).toBe("BUY");
    expect(deriveEaDirection("sell")).toBe("SELL");
    expect(deriveEaDirection("ORDER_TYPE_SELL")).toBe("SELL");
    expect(deriveEaDirection("balance")).toBeNull();
  });

  it("maps profit to DB result enum values", () => {
    expect(deriveEaResult(12.34)).toBe("WIN");
    expect(deriveEaResult(-1)).toBe("LOSS");
    expect(deriveEaResult(0)).toBe("BE");
    expect(deriveEaResult(undefined)).toBe("BE");
  });

  it("builds a schema-compatible auto-verified trade row", () => {
    const built = buildEaTradeRow({
      userId: "user-1",
      brokerAccountId: "account-1",
      payload: {
        ticket: 123,
        symbol: "XAUUSD",
        type: "buy",
        lots: 0.01,
        open_price: 2300,
        close_price: 2305,
        open_time: "2026-05-14T12:00:00.000Z",
        close_time: "2026-05-14T12:05:00.000Z",
        profit: 12.34,
        comment: "test",
      },
    });

    expect(built).toHaveProperty("row");
    if ("error" in built) throw new Error(built.error);
    expect(built.row).toMatchObject({
      user_id: "user-1",
      broker_account_id: "account-1",
      ticket: 123,
      pair: "XAUUSD",
      direction: "BUY",
      result: "WIN",
      trust_badge: "auto_verified",
      capture_source: "ea",
      core_fields_locked: true,
      auto_approved: true,
    });
  });

  // Codex audit H-6a: trust_badge must reflect broker account type so
  // public surfaces don't render prop-firm trades as live retail.
  describe("trust_badge mapping by account type", () => {
    const basePayload = {
      ticket: 1,
      symbol: "EURUSD",
      type: "buy",
      lots: 0.01,
      open_price: 1.1,
      open_time: "2026-05-14T12:00:00.000Z",
    };

    it("tags demo accounts with trust_badge='demo'", () => {
      const built = buildEaTradeRow({
        userId: "u",
        brokerAccountId: "a",
        accountType: "demo",
        payload: basePayload,
      });
      if ("error" in built) throw new Error(built.error);
      expect(built.row.trust_badge).toBe("demo");
    });

    it("tags prop_firm accounts with trust_badge='prop_firm' (not 'auto_verified')", () => {
      const built = buildEaTradeRow({
        userId: "u",
        brokerAccountId: "a",
        accountType: "prop_firm",
        payload: basePayload,
      });
      if ("error" in built) throw new Error(built.error);
      expect(built.row.trust_badge).toBe("prop_firm");
    });

    it("tags live accounts with trust_badge='auto_verified'", () => {
      const built = buildEaTradeRow({
        userId: "u",
        brokerAccountId: "a",
        accountType: "live",
        payload: basePayload,
      });
      if ("error" in built) throw new Error(built.error);
      expect(built.row.trust_badge).toBe("auto_verified");
    });

    it("defaults missing/unknown accountType to trust_badge='auto_verified'", () => {
      const builtNull = buildEaTradeRow({
        userId: "u",
        brokerAccountId: "a",
        accountType: null,
        payload: basePayload,
      });
      const builtUnknown = buildEaTradeRow({
        userId: "u",
        brokerAccountId: "a",
        accountType: "mystery",
        payload: basePayload,
      });
      if ("error" in builtNull) throw new Error(builtNull.error);
      if ("error" in builtUnknown) throw new Error(builtUnknown.error);
      expect(builtNull.row.trust_badge).toBe("auto_verified");
      expect(builtUnknown.row.trust_badge).toBe("auto_verified");
    });
  });
});

describe("eaTradeSchema validation", () => {
  const goodPayload = {
    ticket: 1234567,
    symbol: "eurusd.m",
    type: "buy",
    lots: 0.1,
    open_price: 1.0876,
    open_time: "2026-05-14T12:00:00Z",
  };

  it("accepts a minimal valid payload and uppercases the symbol", () => {
    const parsed = eaTradeSchema.parse(goodPayload);
    expect(parsed.symbol).toBe("EURUSD.M");
    expect(parsed.ticket).toBe(1234567);
  });

  it("rejects symbols with shell/SQL-y characters", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, symbol: "EUR;DROP" }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, symbol: "EUR USD" }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, symbol: "a".repeat(33) }).success).toBe(false);
  });

  it("rejects non-finite numbers and absurd ranges", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, lots: 0 }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, lots: -1 }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, lots: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, open_price: 0 }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, open_price: 1e12 }).success).toBe(false);
  });

  it("rejects garbage timestamps and out-of-window times", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, open_time: "not a date" }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, open_time: "1999-12-31T23:59:59Z" }).success).toBe(false);
    // > 2 years in the future
    const future = new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000).toISOString();
    expect(eaTradeSchema.safeParse({ ...goodPayload, open_time: future }).success).toBe(false);
  });

  it("rejects types that don't contain buy/sell", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, type: "balance" }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, type: "" }).success).toBe(false);
  });

  it("rejects overlong comments", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, comment: "x".repeat(501) }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, comment: "x".repeat(500) }).success).toBe(true);
  });

  it("rejects ticket overflow / non-integer / negative", () => {
    expect(eaTradeSchema.safeParse({ ...goodPayload, ticket: -1 }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, ticket: 1.5 }).success).toBe(false);
    expect(eaTradeSchema.safeParse({ ...goodPayload, ticket: Number.MAX_SAFE_INTEGER + 10 }).success).toBe(false);
  });
});
