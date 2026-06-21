-- UAT 5.9: per-trade visibility = 'exclude' must drop the trade from stats.
-- get_public_adherence (0059) counted every evaluated trade regardless of
-- visibility, so an 'exclude' trade still inflated the public "clean/evaluated"
-- adherence signal. Add `t.visibility != 'exclude'` to both the evaluated and
-- clean counts. (visibility is NOT NULL default 'private', so no NULL handling
-- needed.) 'private' trades still count — only 'exclude' drops, per spec.
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
  select tc.created_at
    into con_created
  from public.trading_constitutions tc
  join public.profiles p on p.id = tc.user_id
  where tc.user_id = profile_id
    and tc.is_active = true
    and tc.adherence_visibility = 'public'
    and p.visibility in ('community','public');

  if con_created is null then
    return;
  end if;

  select count(*)
    into eval_count
  from public.trades t
  where t.user_id = profile_id
    and t.created_at >= con_created
    and t.visibility != 'exclude'
    and (t.status = 'closed' or t.result is not null);

  select count(*)
    into clean_count
  from public.trades t
  where t.user_id = profile_id
    and t.created_at >= con_created
    and t.visibility != 'exclude'
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
