// Shared R:R computation used by both the trade-detail page and the journal
// list. Keep them on one implementation — they previously diverged (the list
// only read the stored rr_ratio while the detail page derived it from prices),
// which made R:R show in the detail view but render "—" in the list.
//
// Returns a 2-dp string, or null when there's no stop loss or no usable target.
//   CLOSED: achieved R:R = |exit − entry| / |entry − stop_loss| (prefer stored).
//   OPEN:   planned  R:R = |take_profit − entry| / |entry − stop_loss|.
// Open trades never use exit_price (it's 0/null while open). Every division is
// guarded against a zero risk leg.
export function computeRR(args: {
  entry: number | null;
  exit: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  storedRR: number | null;
  isClosed: boolean;
}): string | null {
  const { entry, exit, stopLoss, takeProfit, storedRR, isClosed } = args;
  if (stopLoss == null || stopLoss === 0 || entry == null) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0) return null;

  if (isClosed) {
    // Achieved R:R from the realized exit. Prefer the stored ratio.
    if (storedRR != null && storedRR !== 0) return storedRR.toFixed(2);
    if (exit != null && exit !== 0) {
      return (Math.abs(exit - entry) / risk).toFixed(2);
    }
    return null;
  }

  // OPEN: planned R:R from the take-profit target — never the exit.
  if (takeProfit != null && takeProfit !== 0) {
    return (Math.abs(takeProfit - entry) / risk).toFixed(2);
  }
  return null;
}
