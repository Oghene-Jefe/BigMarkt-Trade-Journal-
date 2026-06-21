-- UAT 9.7: referral counts never increased. The LIVE handle_new_user trigger
-- did not copy referred_by from auth metadata into profiles (migration 0032's
-- version was never applied to prod / was superseded). Re-assert the version
-- that copies referred_by, then backfill rows that lost it — the codes are
-- still in auth.users.raw_user_meta_data because the signup action stored them.
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

-- Backfill: recover referral attributions for profiles that were created
-- without referred_by but whose auth metadata still carries the code.
update public.profiles p
set referred_by = nullif(trim(u.raw_user_meta_data->>'referred_by'), ''),
    updated_at  = now()
from auth.users u
where u.id = p.id
  and (p.referred_by is null or p.referred_by = '')
  and nullif(trim(u.raw_user_meta_data->>'referred_by'), '') is not null;
