// Bybit's /v5/position/closed-pnl rejects requests where
// endTime - startTime > 7 days. To backfill a longer history, we issue
// multiple windowed calls. This helper splits an arbitrary [start, end]
// range into an array of <=7-day windows.

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type Window = { startMs: number; endMs: number };

export function splitIntoSevenDayWindows(startMs: number, endMs: number): Window[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("splitIntoSevenDayWindows: non-finite input");
  }
  if (endMs <= startMs) return [];

  const windows: Window[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const next = Math.min(cursor + SEVEN_DAYS_MS, endMs);
    windows.push({ startMs: cursor, endMs: next });
    cursor = next;
  }
  return windows;
}
