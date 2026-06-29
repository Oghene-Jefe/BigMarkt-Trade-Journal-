-- 0081_search_profiles.sql
-- Discovery: search community/public profiles by display_name or username.
-- SECURITY DEFINER so it can read profiles past RLS, but hard-filtered to
-- only ever return community/public rows (never private), and never the
-- caller themselves. Min query length 2 — shorter returns empty. Capped 20.
-- is_leader = trader has a leaderboard-eligible score on any account (matches
-- who actually appears on the leaderboard; for future "leaders only" filter).
drop function if exists public.search_profiles(text);
create function public.search_profiles(q text)
returns table (
  user_id      uuid,
  display_name text,
  username     text,
  avatar_path  text,
  visibility   text,
  is_leader    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with cleaned as (
    select btrim(coalesce(q, '')) as term
  )
  select
    p.id            as user_id,
    p.display_name,
    p.username,
    p.avatar_path,
    p.visibility,
    exists (
      select 1
      from public.account_scores s
      where s.user_id = p.id
        and (s.active_eligible or s.pro_eligible)
    )               as is_leader
  from public.profiles p, cleaned c
  where char_length(c.term) >= 2
    and p.visibility in ('community','public')
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and (
      p.display_name ilike '%' || c.term || '%'
      or p.username  ilike '%' || c.term || '%'
    )
  order by
    (lower(p.username) = lower(c.term)) desc,
    (p.username ilike c.term || '%') desc,
    (p.display_name ilike c.term || '%') desc,
    p.display_name asc
  limit 20;
$$;
revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;
