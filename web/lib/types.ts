// DB row shapes mirrored from the live prod schema.
// Session 1: trust_badge, capture_source, core_fields_locked, auto_approved, journal_mode
// Session 2: username on profiles, followers_only on trades visibility

export type TrustBadge = 'manual' | 'auto_verified' | 'draft' | 'edited' | 'prop_firm';
export type CaptureSource = 'manual' | 'ea' | 'websocket' | 'signal';
export type JournalMode = 'manual' | 'automated';

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
  tos_automation_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountType = 'live' | 'demo' | 'prop_firm';

export interface BrokerAccount {
  id: string;
  user_id: string;
  label: string;
  broker_slug: string;
  account_type: AccountType;
  journal_mode: 'manual' | 'automated';
  is_prop_firm: boolean;
  is_active: boolean;
  account_number: string | null;
  readonly_password: string | null;
  created_at: string;
  updated_at: string;
  broker_account_id?: string;
}

export type ScoreTier = 'none' | 'active' | 'pro';

export interface AccountScore {
  id: string;
  broker_account_id: string;
  user_id: string;

  active_expectancy_score: number;
  active_winrate_score: number;
  active_drawdown_score: number;
  active_regularity_score: number;
  active_score: number;
  active_eligible: boolean;

  pro_expectancy_score: number;
  pro_sortino_score: number;
  pro_drawdown_score: number;
  pro_regularity_score: number;
  pro_score: number;
  pro_eligible: boolean;

  score_tier: ScoreTier;

  trade_count: number;
  win_rate_pct: number;
  avg_rr: number;
  expectancy_pct: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  max_drawdown_weeks: number;
  weekly_trade_cv: number;
  account_history_days: number;

  gate_min_trades_active: boolean;
  gate_min_days_active: boolean;
  gate_positive_expectancy: boolean;
  gate_automated_mode: boolean;
  gate_live_account: boolean;
  gate_min_trades_pro: boolean;
  gate_min_days_pro: boolean;
  gate_max_drawdown_pro: boolean;

  last_scored_at: string | null;
  created_at: string;
  updated_at: string;
}

// Session 10: copy-trading / signal infrastructure
export type FlowDirection = 'leader' | 'follower' | 'inactive';
export type SubscriptionMode = 'journal_only' | 'execution';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type SignalStatus = 'live' | 'pending' | 'expired' | 'filled' | 'cancelled' | 'suspended';
export type SignalType = 'market' | 'limit';
export type MinSignalGrade = 'A+' | 'A' | 'B' | 'C' | 'any';

export interface Subscription {
  id: string;
  follower_id: string;
  leader_id: string;
  broker_account_id: string;
  mode: SubscriptionMode;
  status: SubscriptionStatus;
  min_signal_grade: MinSignalGrade;
  leader_also_follows: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignalEntry {
  id: string;
  leader_id: string;
  broker_account_id: string;
  trade_id: string | null;
  pair: string;
  direction: 'BUY' | 'SELL';
  signal_type: SignalType;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  setup_grade: string | null;
  status: SignalStatus;
  notes: string | null;
  expires_at: string | null;
  filled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignalLog {
  id: string;
  signal_id: string;
  subscription_id: string;
  follower_id: string;
  leader_id: string;
  action: string;
  status: SignalStatus;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface NewsEvent {
  id: string;
  title: string;
  currency: string | null;
  impact: 'low' | 'medium' | 'high' | null;
  event_time: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}
