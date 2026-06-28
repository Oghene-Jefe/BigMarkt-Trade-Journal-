-- 0079_public_trades_thesis.sql
-- C4b read path: surface trade_thesis on public trades. Same signature and
-- visibility guard as 0077 — only adds the trade_thesis column.
drop function if exists public.get_public_trades(uuid, int);
create function public.get_public_trades(profile_id uuid, lim int default 20)
returns table (
  id                  uuid,
  pair                text,
  direction           text,
  result              text,
  entry_price         numeric,
  exit_price          numeric,
  stop_loss           numeric,
  take_profit         numeric,
  lot_size            numeric,
  return_pct          numeric,
  rr_ratio            numeric,
  session             text,
  setup_grade         text,
  trade_thesis        text,
  chart_path          text,
  visibility          text,
  trust_badge         text,
  capture_source      text,
  core_fields_locked  boolean,
  created_at          timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    t.id, t.pair, t.direction, t.result,
    t.entry_price, t.exit_price, t.stop_loss, t.take_profit,
    t.lot_size, t.return_pct, t.rr_ratio,
    t.session, t.setup_grade,
    t.trade_thesis,
    t.chart_path,
    t.visibility, t.trust_badge, t.capture_source,
    t.core_fields_locked, t.created_at
  from public.trades t
  join public.profiles p on p.id = t.user_id
  where t.user_id        = profile_id
    and t.visibility     = 'public'
    and t.trust_badge   != 'demo'
    and (
      p.visibility = 'public'
      or (p.visibility = 'community' and auth.uid() is not null)
    )
  order by t.created_at desc
  limit lim;
$$;
revoke all on function public.get_public_trades(uuid, int) from public;
grant execute on function public.get_public_trades(uuid, int) to authenticated, anon;
