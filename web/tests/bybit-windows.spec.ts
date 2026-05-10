/**
 * 7-day window splitter for Bybit /v5/position/closed-pnl, which rejects
 * windows wider than 604_800_000 ms.
 */
import { describe, it, expect } from "vitest";
import { splitIntoSevenDayWindows } from "@/lib/exchanges/bybit/windows";

const DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * DAY;

describe("splitIntoSevenDayWindows", () => {
  it("returns one window for a 1-day range", () => {
    const out = splitIntoSevenDayWindows(0, DAY);
    expect(out).toEqual([{ startMs: 0, endMs: DAY }]);
  });

  it("returns one window for an exactly-7-day range", () => {
    const out = splitIntoSevenDayWindows(0, SEVEN_DAYS);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ startMs: 0, endMs: SEVEN_DAYS });
  });

  it("splits 14 days into two equal windows", () => {
    const out = splitIntoSevenDayWindows(0, 14 * DAY);
    expect(out).toEqual([
      { startMs: 0, endMs: SEVEN_DAYS },
      { startMs: SEVEN_DAYS, endMs: 14 * DAY },
    ]);
  });

  it("splits 30 days into 5 windows (4 full + 1 short)", () => {
    const out = splitIntoSevenDayWindows(0, 30 * DAY);
    expect(out).toHaveLength(5);
    // First four are exactly 7 days
    for (let i = 0; i < 4; i++) {
      expect(out[i].endMs - out[i].startMs).toBe(SEVEN_DAYS);
    }
    // Final is the remainder
    expect(out[4].endMs - out[4].startMs).toBe(2 * DAY);
    // Windows are contiguous
    for (let i = 1; i < out.length; i++) {
      expect(out[i].startMs).toBe(out[i - 1].endMs);
    }
  });

  it("never produces a window > 7 days", () => {
    const out = splitIntoSevenDayWindows(0, 100 * DAY);
    for (const w of out) {
      expect(w.endMs - w.startMs).toBeLessThanOrEqual(SEVEN_DAYS);
    }
  });

  it("returns empty array when end <= start", () => {
    expect(splitIntoSevenDayWindows(0, 0)).toEqual([]);
    expect(splitIntoSevenDayWindows(100, 50)).toEqual([]);
  });

  it("throws on non-finite input", () => {
    expect(() => splitIntoSevenDayWindows(NaN, 100)).toThrow();
    expect(() => splitIntoSevenDayWindows(0, Infinity)).toThrow();
  });

  it("respects the original endMs (no overshoot on final window)", () => {
    const start = 1700000000000;
    const end = start + 10 * DAY + 12345;
    const out = splitIntoSevenDayWindows(start, end);
    expect(out[out.length - 1].endMs).toBe(end);
  });
});
