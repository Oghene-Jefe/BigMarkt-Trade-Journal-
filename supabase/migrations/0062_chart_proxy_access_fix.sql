-- Tighten get_chart_path_for_viewer (added in 0061) so it mirrors
-- get_public_trades (migration 0046) EXACTLY. 0061 was missing two conditions,
-- which let ANY caller (including anonymous) fetch chart bytes for:
--   1. public *demo* trades (no `trust_badge != 'demo'` check), and
--   2. community-tier traders' public trades while signed out
--      (community exposure must require an authenticated session).
-- Both are now gated, matching the canonical public-visibility rule.
create or replace function public.get_chart_path_for_viewer(p_trade_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select t.chart_path
  from public.trades t
  where t.id = p_trade_id
    and t.chart_path is not null
    and (
      t.user_id = auth.uid()
      or (
        t.visibility = 'public'
        and t.trust_badge != 'demo'
        and exists (
          select 1
          from public.profiles p
          where p.id = t.user_id
            and (
              p.visibility = 'public'
              or (p.visibility = 'community' and auth.uid() is not null)
            )
        )
      )
    );
$$;
revoke all on function public.get_chart_path_for_viewer(uuid) from public;
grant execute on function public.get_chart_path_for_viewer(uuid) to anon, authenticated;
