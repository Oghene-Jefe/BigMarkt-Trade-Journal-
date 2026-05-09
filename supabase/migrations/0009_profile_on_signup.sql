-- =============================================================================
-- 0009_profile_on_signup.sql
-- Ensures every auth.users row has a corresponding public.profiles row.
-- The old static app handled this client-side after signup; the new app
-- pushes it to the database so neither the new server actions nor the old
-- JS-based signup flow can leave an account profile-less.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, source, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', null),
    'signup',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing auth.users without a profiles row gets one now.
insert into public.profiles (id, email, source, created_at, updated_at)
select au.id, au.email, 'backfill', coalesce(au.created_at, now()), now()
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;
