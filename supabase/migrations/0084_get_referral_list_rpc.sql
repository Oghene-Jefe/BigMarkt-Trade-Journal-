-- 0084_get_referral_list_rpc.sql
-- Leader-facing referral list: who signed up under the caller's referral code.
-- Complements get_referral_stats (count only). SECURITY DEFINER but derives the
-- caller's OWN code from auth.uid() (takes NO param) so a user can never
-- enumerate another user's referrals. Public-safe fields only — no email/trades.
-- Identity rule: display_name + join date + is_active always; username exposed
-- only when the referred user's profile is public, else null (masked in the UI).
-- Applied MANUALLY in the Supabase SQL Editor (never `supabase db push`).

create or replace function public.get_referral_list()
returns table (
  display_name text,
  username text,
  is_public boolean,
  joined_at timestamptz,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.display_name,
    case when p.visibility = 'public' then p.username else null end as username,
    (p.visibility = 'public') as is_public,
    p.created_at as joined_at,
    exists (select 1 from public.trades t where t.user_id = p.id) as is_active
  from public.profiles p
  where p.referred_by = substr(
    replace(replace(encode(convert_to(auth.uid()::text, 'UTF8'), 'base64'), chr(10), ''), '=', ''),
    1, 12
  )
  order by p.created_at desc
  limit 200;
$$;

grant execute on function public.get_referral_list() to authenticated;
