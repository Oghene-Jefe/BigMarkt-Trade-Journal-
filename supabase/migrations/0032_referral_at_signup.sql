-- =============================================================================
-- 0032_referral_at_signup.sql
-- Extends handle_new_user (0009) to also copy a referral code from auth user
-- metadata into profiles.referred_by. The signup server action passes the
-- code via sb.auth.signUp({ options: { data: { referred_by } } }), which lands
-- in auth.users.raw_user_meta_data. The trigger then propagates it into the
-- profiles row at insert time.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, referred_by, source, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', null),
    nullif(trim(new.raw_user_meta_data->>'referred_by'), ''),
    'signup',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
