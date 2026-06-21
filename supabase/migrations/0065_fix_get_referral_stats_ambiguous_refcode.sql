-- UAT 9.7 (part 2): get_referral_stats always errored with
-- "42702: column reference \"ref_code\" is ambiguous" because the function
-- parameter `ref_code` collides with the profiles.ref_code column. The profile
-- page swallows the RPC error and renders 0, so the referral count could never
-- show even once referred_by was being stored.
--
-- Fix: qualify the parameter as get_referral_stats.ref_code (and alias the
-- tables) so Postgres resolves it to the parameter, not the column. The
-- signature is unchanged so the app's sb.rpc("get_referral_stats", { ref_code })
-- call still binds. Also pins search_path (the prior version lacked it).
create or replace function public.get_referral_stats(ref_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  referred_ids uuid[];
  total_count  integer;
  active_count integer;
begin
  select array_agg(p.id), count(*)
    into referred_ids, total_count
  from public.profiles p
  where p.referred_by = get_referral_stats.ref_code;

  if total_count = 0 or referred_ids is null then
    return json_build_object('total', 0, 'active', 0);
  end if;

  select count(distinct t.user_id)
    into active_count
  from public.trades t
  where t.user_id = any(referred_ids);

  return json_build_object('total', total_count, 'active', active_count);
end;
$$;
