// Short human labels for constitution rule_keys. Pure, shared by the journal
// badge and the trade-detail violations list.
//
// Both `max_daily_loss` and `max_daily_loss_pct` map to the same label so the
// UI is resilient to whichever key the engine emits.
export const RULE_LABELS: Record<string, string> = {
  require_stop_loss: "No stop loss",
  max_risk_pct: "Risk over limit",
  min_rr: "R:R below min",
  max_trades_per_day: "Over daily trade limit",
  allowed_instruments: "Instrument not allowed",
  max_daily_loss: "Past daily loss limit",
  max_daily_loss_pct: "Past daily loss limit",
};

// Human label for a rule_key, falling back to a readable version of the key.
export function ruleLabel(key: string): string {
  return RULE_LABELS[key] ?? key.replace(/_/g, " ");
}
