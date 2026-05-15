import { describe, expect, it } from "vitest";
import { buildEaTradeRow, deriveEaDirection, deriveEaResult } from "@/lib/ea/normalize";

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
});
