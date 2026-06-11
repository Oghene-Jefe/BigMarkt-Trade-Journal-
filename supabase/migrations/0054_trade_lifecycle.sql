-- Lifecycle event timeline (powers the detail page; partial-close & modification safe)
create table if not exists public.trade_events (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid references public.trades(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id text,
  order_ticket text,
  event_type text not null,  -- pending_set | pending_modified | pending_cancelled | filled | sl_tp_modified | partial_close | closed
  price numeric(20,5),
  sl numeric(20,5),
  tp numeric(20,5),
  lots numeric(20,5),
  pnl numeric(20,5),
  event_time timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists trade_events_trade_id_idx on public.trade_events(trade_id);
create index if not exists trade_events_user_id_idx on public.trade_events(user_id);
create index if not exists trade_events_pos_idx on public.trade_events(user_id, position_id) where position_id is not null;
alter table public.trade_events enable row level security;
create policy trade_events_self_select on public.trade_events
  for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policy: only the service-role EA path writes events

-- Backfill canonical columns from EA columns (0 means "no value" → null so the card stays blank)
update public.trades set
  stop_loss   = coalesce(stop_loss,   nullif(sl, 0)),
  take_profit = coalesce(take_profit, nullif(tp, 0)),
  rr_ratio    = coalesce(rr_ratio,    nullif(r_multiple, 0))
where capture_source = 'ea';

-- Normalize status nulls before app relies on it
update public.trades set status = 'closed' where status is null;
