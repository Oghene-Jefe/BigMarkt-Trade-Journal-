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
        and exists (
          select 1
          from public.profiles p
          where p.id = t.user_id
            and p.visibility in ('community', 'public')
        )
      )
    );
$$;
revoke all on function public.get_chart_path_for_viewer(uuid) from public;
grant execute on function public.get_chart_path_for_viewer(uuid) to anon, authenticated;
