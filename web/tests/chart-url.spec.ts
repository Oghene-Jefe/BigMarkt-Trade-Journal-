import { describe, it, expect } from "vitest";
import { chartProxyUrl } from "@/lib/chart-url";

describe("chartProxyUrl", () => {
  it("returns the bare proxy path without a chart_path", () => {
    expect(chartProxyUrl("trade-1")).toBe("/c/trade-1");
    expect(chartProxyUrl("trade-1", null)).toBe("/c/trade-1");
  });

  it("appends ?v=<timestamp> from the chart_path", () => {
    const path = "user-1/trade-1/chart-1718900000000.jpg";
    expect(chartProxyUrl("trade-1", path)).toBe("/c/trade-1?v=1718900000000");
  });

  it("yields a different URL after a chart replace (new timestamp)", () => {
    const first = chartProxyUrl("t", "u/t/chart-1000.jpg");
    const second = chartProxyUrl("t", "u/t/chart-2000.png");
    expect(first).not.toBe(second);
  });

  it("falls back to the bare path when chart_path has no timestamp", () => {
    expect(chartProxyUrl("t", "u/t/legacy.png")).toBe("/c/t");
  });
});
