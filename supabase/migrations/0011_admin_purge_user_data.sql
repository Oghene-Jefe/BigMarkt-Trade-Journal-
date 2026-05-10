-- =============================================================================
-- 0011_admin_purge_user_data.sql
-- Replaces admin_delete_user (which only deleted profiles, leaving the auth
-- user + all child data intact) with admin_purge_user_data: explicitly
-- removes everything in public.* belonging to the target user, but
-- intentionally leaves auth.users untouched.
--
-- Why not delete auth.users from this function: SECURITY DEFINER functions
-- run as the function owner (postgres in Supabase), but auth.users is
-- managed by the supabase_auth_admin role and writes from postgres are
-- discouraged. To fully delete the auth account, use the Supabase dashboard
-- or call auth.admin.deleteUser() from a service-role-keyed Edge Function.
--
-- For most "remove this user from the app" admin actions, purging the
-- public.* data is the right semantics — they can no longer log in
-- (well, they can, but they have no profile / trades / etc.) and a
-- platform admin can finalise the auth deletion via dashboard if needed.
-- =============================================================================

drop function if exists public.admin_delete_user(uuid);

create or replace function public.admin_purge_user_data(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Order matters only stylistically (FKs cascade either way) but we
  -- delete child rows first so partial failures leave consistent state.
  delete from public.trades         where user_id = target_id;
  delete from public.balance_resets where user_id = target_id;
  delete from public.challenges     where user_id = target_id;
  delete from public.profiles       where id = target_id;
  -- public.admin_users is not touched here — admins should not be able to
  -- demote each other accidentally via this entrypoint. Use a separate
  -- migration / SQL editor action to remove admin grants.
end;
$$;

revoke all on function public.admin_purge_user_data(uuid) from public;
grant execute on function public.admin_purge_user_data(uuid) to authenticated;

comment on function public.admin_purge_user_data is
  'Removes all public.* rows belonging to target_id. Leaves auth.users row intact.';
