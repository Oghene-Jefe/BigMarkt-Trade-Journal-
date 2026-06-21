import { describe, it, expect } from "vitest";
import { computeRR } from "@/lib/rr";

describe("computeRR", () => {
  it("returns null when there is no stop loss", () => {
    expect(
      computeRR({ entry: 1.1, exit: 1.2, stopLoss: null, takeProfit: 1.2, storedRR: null, isClosed: true }),
    ).toBeNull();
  });

  it("returns null when risk leg is zero (stop == entry)", () => {
    expect(
      computeRR({ entry: 1.1, exit: 1.2, stopLoss: 1.1, takeProfit: 1.2, storedRR: null, isClosed: true }),
    ).toBeNull();
  });

  it("CLOSED: prefers the stored ratio when present", () => {
    expect(
      computeRR({ entry: 1.1, exit: 1.2, stopLoss: 1.0, takeProfit: 1.3, storedRR: 2.5, isClosed: true }),
    ).toBe("2.50");
  });

  it("CLOSED: derives achieved R:R from the exit when no stored ratio (the list-vs-detail bug)", () => {
    // risk = |1.1 - 1.0| = 0.1 ; reward = |1.2 - 1.1| = 0.1 -> 1.00
    expect(
      computeRR({ entry: 1.1, exit: 1.2, stopLoss: 1.0, takeProfit: null, storedRR: null, isClosed: true }),
    ).toBe("1.00");
  });

  it("OPEN: planned R:R from take-profit, never the exit", () => {
    // risk = |1.1 - 1.0| = 0.1 ; reward = |1.4 - 1.1| = 0.3 -> 3.00
    expect(
      computeRR({ entry: 1.1, exit: 999, stopLoss: 1.0, takeProfit: 1.4, storedRR: null, isClosed: false }),
    ).toBe("3.00");
  });

  it("OPEN: null when no take-profit target", () => {
    expect(
      computeRR({ entry: 1.1, exit: 0, stopLoss: 1.0, takeProfit: null, storedRR: null, isClosed: false }),
    ).toBeNull();
  });
});
