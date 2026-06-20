-- =============================================================================
-- 0059_public_adherence_rpc.sql
-- Public, aggregate-only Trading Constitution adherence for the /p/[id] share
-- page. Anon callers can't read trading_constitutions / constitution_violations
-- (RLS), so this SECURITY DEFINER function exposes ONLY the aggregate
-- (pct, evaluated, clean) — never any per-rule violation detail.
--
-- Two layers of opt-in, both required:
--   1. trading_constitutions.is_active = true AND adherence_visibility = 'public'
--   2. profiles.visibility in ('community','public')
-- If either fails, the function returns NO rows.
--
-- Trade-level logic mirrors web/lib/constitution/adherence.ts:
--   evaluated = trades created_at >= constitution.created_at AND
--               (status = 'closed' OR result IS NOT NULL)
--   clean     = evaluated trades with no constitution_violations row
--   pct       = round(clean / evaluated * 100) when evaluated > 0 else null
-- =============================================================================

drop function if exists public.get_public_adherence(uuid);

create or replace function public.get_public_adherence(profile_id uuid)
returns table (
  pct       numeric,
  evaluated int,
  clean     int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  con_created timestamptz;
  eval_count  int;
  clean_count int;
begin
  -- Gate: active + publicly-opted-in constitution AND a shareable profile.
  select tc.created_at
    into con_created
  from public.trading_constitutions tc
  join public.profiles p on p.id = tc.user_id
  where tc.user_id = profile_id
    and tc.is_active = true
    and tc.adherence_visibility = 'public'
    and p.visibility in ('community','public');

  if con_created is null then
    return;  -- not opted in / not shareable → no rows
  end if;

  select count(*)
    into eval_count
  from public.trades t
  where t.user_id = profile_id
    and t.created_at >= con_created
    and (t.status = 'closed' or t.result is not null);

  select count(*)
    into clean_count
  from public.trades t
  where t.user_id = profile_id
    and t.created_at >= con_created
    and (t.status = 'closed' or t.result is not null)
    and not exists (
      select 1
      from public.constitution_violations cv
      where cv.trade_id = t.id
    );

  pct       := case when eval_count > 0
                    then round((clean_count::numeric / eval_count) * 100)
                    else null end;
  evaluated := eval_count;
  clean     := clean_count;
  return next;
end;
$$;

revoke all on function public.get_public_adherence(uuid) from public;
grant execute on function public.get_public_adherence(uuid) to authenticated, anon;
