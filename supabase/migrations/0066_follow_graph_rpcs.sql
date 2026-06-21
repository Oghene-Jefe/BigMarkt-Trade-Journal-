-- UAT 11: public Followers/Following on profiles. The subscriptions table's RLS
-- restricts callers to their own rows, so expose the follow graph via security
-- definer RPCs (granted to anon + authenticated). Only public profile fields
-- are returned — never email. A "follow" is any subscription that isn't
-- cancelled (active or paused both count).
create or replace function public.get_follow_counts(profile_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'followers', (
      select count(distinct s.follower_id)
      from public.subscriptions s
      where s.leader_id = profile_id and s.status <> 'cancelled'
    ),
    'following', (
      select count(distinct s.leader_id)
      from public.subscriptions s
      where s.follower_id = profile_id and s.status <> 'cancelled'
    )
  );
$$;
revoke all on function public.get_follow_counts(uuid) from public;
grant execute on function public.get_follow_counts(uuid) to anon, authenticated;

-- direction = 'followers' → users who follow profile_id
-- direction = 'following' → users profile_id follows
create or replace function public.get_follow_list(profile_id uuid, direction text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.username, p.display_name, p.avatar_path
  from public.subscriptions s
  join public.profiles p
    on p.id = case when direction = 'followers' then s.follower_id else s.leader_id end
  where case when direction = 'followers' then s.leader_id else s.follower_id end = profile_id
    and s.status <> 'cancelled';
$$;
revoke all on function public.get_follow_list(uuid, text) from public;
grant execute on function public.get_follow_list(uuid, text) to anon, authenticated;
