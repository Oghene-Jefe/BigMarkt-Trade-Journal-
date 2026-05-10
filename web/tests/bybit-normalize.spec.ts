/**
 * Normalisers turn Bybit's string-heavy REST payloads into typed records:
 * numeric strings → numbers (or null when missing), ms timestamps → ISO,
 * empty strings → null, and the original payload preserved as `raw`.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeClosedPnl,
  normalizeExecution,
} from "@/lib/exchanges/bybit/normalize";

describe("normalizeClosedPnl", () => {
  it("converts a fully-populated row", () => {
    const raw = {
      symbol: "BTCUSDT",
      orderId: "ord-1",
      side: "Buy",
      qty: "0.5",
      closedSize: "0.5",
      avgEntryPrice: "30000",
      avgExitPrice: "31000",
      closedPnl: "500",
      openFee: "1.5",
      closeFee: "1.55",
      leverage: "10",
      orderType: "Market",
      execType: "Trade",
      createdTime: "1700000000000",
      updatedTime: "1700001000000",
    };
    const r = normalizeClosedPnl(raw);
    expect(r.symbol).toBe("BTCUSDT");
    expect(r.side).toBe("Buy");
    expect(r.qty).toBe(0.5);
    expect(r.avgEntryPrice).toBe(30000);
    expect(r.avgExitPrice).toBe(31000);
    expect(r.closedPnl).toBe(500);
    expect(r.leverage).toBe(10);
    expect(r.createdAt).toBe("2023-11-14T22:13:20.000Z");
    expect(r.closedAt).toBe("2023-11-14T22:30:00.000Z");
    expect(r.raw).toBe(raw);
  });

  it("handles empty strings as null", () => {
    const r = normalizeClosedPnl({
      symbol: "ETHUSDT",
      orderId: "x",
      side: "Sell",
      qty: "",
      closedSize: "",
      avgEntryPrice: "",
      avgExitPrice: "",
      closedPnl: "",
      openFee: "",
      closeFee: "",
      leverage: "",
      orderType: "",
      execType: "",
      createdTime: "1700000000000",
      updatedTime: "1700000000000",
    });
    expect(r.qty).toBeNull();
    expect(r.avgEntryPrice).toBeNull();
    expect(r.closedPnl).toBeNull();
    expect(r.leverage).toBeNull();
    expect(r.orderType).toBeNull();
  });

  it("treats unknown side as Buy (defensive default)", () => {
    const r = normalizeClosedPnl({
      symbol: "X",
      orderId: "x",
      side: "weird",
      updatedTime: "1700000000000",
    });
    expect(r.side).toBe("Buy");
  });

  it("falls back createdAt → closedAt when createdTime missing", () => {
    const r = normalizeClosedPnl({
      symbol: "X",
      orderId: "x",
      side: "Buy",
      updatedTime: "1700000000000",
    });
    expect(r.createdAt).toBe(r.closedAt);
    expect(r.closedAt).toBe("2023-11-14T22:13:20.000Z");
  });
});

describe("normalizeExecution", () => {
  it("converts a fully-populated row", () => {
    const raw = {
      symbol: "BTCUSDT",
      orderId: "ord-1",
      orderLinkId: "link-1",
      side: "Sell",
      orderPrice: "30000",
      orderQty: "0.1",
      execPrice: "30000.5",
      execQty: "0.1",
      execValue: "3000.05",
      execFee: "0.0015",
      feeRate: "0.0005",
      feeCurrency: "USDT",
      execType: "Trade",
      isMaker: false,
      closedSize: "0.1",
      seq: 12345,
      execId: "exec-abc",
      execTime: "1700000000000",
    };
    const r = normalizeExecution(raw);
    expect(r.symbol).toBe("BTCUSDT");
    expect(r.side).toBe("Sell");
    expect(r.execPrice).toBe(30000.5);
    expect(r.execFee).toBe(0.0015);
    expect(r.feeCurrency).toBe("USDT");
    expect(r.isMaker).toBe(false);
    expect(r.seq).toBe("12345");
    expect(r.execId).toBe("exec-abc");
    expect(r.executedAt).toBe("2023-11-14T22:13:20.000Z");
    expect(r.raw).toBe(raw);
  });

  it("coerces isMaker boolean from string 'true'", () => {
    const r = normalizeExecution({
      symbol: "X",
      orderId: "x",
      side: "Buy",
      execId: "e",
      execTime: "1700000000000",
      isMaker: "true",
    });
    expect(r.isMaker).toBe(true);
  });

  it("nulls out missing fee fields", () => {
    const r = normalizeExecution({
      symbol: "X",
      orderId: "x",
      side: "Buy",
      execId: "e",
      execTime: "1700000000000",
      execFee: "",
      feeRate: "",
      feeCurrency: "",
    });
    expect(r.execFee).toBeNull();
    expect(r.feeRate).toBeNull();
    expect(r.feeCurrency).toBeNull();
  });
});
