// DB row shapes mirrored from the live prod schema.
// Session 1: trust_badge, capture_source, core_fields_locked, auto_approved, journal_mode
// Session 2: username on profiles, followers_only on trades visibility

export type TrustBadge = 'manual' | 'auto_verified' | 'draft' | 'edited' | 'prop_firm';
export type CaptureSource = 'manual' | 'ea' | 'websocket';
export type JournalMode = 'manual' | 'automated' | 'hybrid';

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
  visibility: "private" | "public" | "exclude" | "followers_only";
  trade_visibility: string | null;
  trust_badge: TrustBadge;
  capture_source: CaptureSource;
  core_fields_locked: boolean;
  auto_approved: boolean;
  created_at: string;
};

export type LeaderboardEntry = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  visibility: string;
  journal_mode: JournalMode;
  trade_count: number;
  win_rate: number;
  total_pnl: number;
  avg_rr: number;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  visibility: "community" | "public";
  trade_count: number;
  win_rate: number;
  total_pnl: number;
  growth_pct: number | null;
};

export type PublicProfileFull = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  visibility: string;
  journal_mode: JournalMode;
  username: string | null;
  trade_count: number;
  win_rate: number;
  total_pnl: number;
  growth_pct: number | null;
};

export type PublicTrade = {
  id: string;
  pair: string | null;
  direction: "BUY" | "SELL" | null;
  result: "WIN" | "LOSS" | "BE" | null;
  pnl: number | null;
  rr_ratio: number | null;
  setup_grade: string | null;
  tags: string | null;
  notes: string | null;
  chart_path: string | null;
  trust_badge: TrustBadge;
  capture_source: CaptureSource;
  core_fields_locked: boolean;
  created_at: string;
};

export type BalanceResetRow = {
  id: string;
  user_id: string;
  previous_balance: number | null;
  new_balance: number | null;
  reason: string | null;
  reset_date: string | null;
  created_at: string;
};

export type ChallengeRow = {
  id: string;
  user_id: string;
  goal_type: string | null;
  goal_target: number | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "completed" | "failed" | "abandoned" | null;
  current_streak: number | null;
  longest_streak: number | null;
  badge_earned: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  starting_balance: number | null;
  source: string | null;
  referred_by: string | null;
  ref_code: string | null;
  timezone: string | null;
  experience: string | null;
  preferred_pairs: string | null;
  daily_loss_limit: number | null;
  visibility: "private" | "community" | "public";
  journal_mode: JournalMode;
  username: string | null;
  created_at: string;
  updated_at: string;
};
