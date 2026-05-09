// DB row shapes mirrored from the live prod schema. Column names match
// the actual `public.trades` and `public.profiles` tables — these were
// established by the older static app and the rebuild keeps them.
//
// Key naming quirks (kept for backwards-compat with the static app):
//   entry_price, exit_price, stop_loss, lot_size, setup_grade
//   tags is a free-text comma-separated string, not text[]
//   profiles.preferred_pairs is text, not text[]
//
// `trade_visibility` is the legacy column (still written by the old app).
// `visibility` is the new one used by RLS + the leaderboard RPC. Migration
// 0005 backfills new from old; both are populated for now.

export type TradeRow = {
  id: string;
  user_id: string;
  pair: string | null;
  direction: "BUY" | "SELL" | null;
  result: "WIN" | "LOSS" | "BE" | null;
  pnl: number | null;
  rr_ratio: number | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  session: string | null;
  emotions: string | null;
  strategy: string | null;
  setup_grade: string | null;
  tags: string | null;
  notes: string | null;
  image_url: string | null;
  chart_path: string | null;
  visibility: "private" | "public" | "exclude";
  trade_visibility: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  starting_balance: number | null;
  source: string | null;
  referred_by: string | null;
  ref_code: string | null;
  timezone: string | null;
  experience: string | null;
  preferred_pairs: string | null;
  daily_loss_limit: number | null;
  visibility: "private" | "community" | "public";
  created_at: string;
  updated_at: string;
};
