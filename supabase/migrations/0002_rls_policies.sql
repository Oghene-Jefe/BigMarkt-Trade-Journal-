-- =============================================================================
-- 0002_rls_policies.sql
-- Strict RLS: anon reads NOTHING from base tables. All public/community reads
-- go through SECURITY DEFINER RPCs or sanitized views in 0003.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.trades          enable row level security;
alter table public.balance_resets  enable row level security;
alter table public.challenges      enable row level security;
alter table public.admin_users     enable row level security;

-- Drop any prior policies (idempotent).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','trades','balance_resets','challenges','admin_users')
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------- profiles ---------------------------------------------------------
-- Owner can read/write their own row. NO anon access. NO cross-user reads.
-- Public/community discovery happens through profiles_public view + RPCs.
create policy "profiles_self_select"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_self_insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: deletion goes through admin RPC or auth.users cascade.

-- ---------- trades -----------------------------------------------------------
create policy "trades_self_select"
  on public.trades for select
  to authenticated
  using (user_id = auth.uid());

create policy "trades_self_insert"
  on public.trades for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "trades_self_update"
  on public.trades for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "trades_self_delete"
  on public.trades for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- balance_resets ---------------------------------------------------
create policy "resets_self_select"
  on public.balance_resets for select
  to authenticated
  using (user_id = auth.uid());

create policy "resets_self_insert"
  on public.balance_resets for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------- challenges -------------------------------------------------------
create policy "challenges_self_all"
  on public.challenges for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- admin_users ------------------------------------------------------
-- Readable only via is_admin() SECURITY DEFINER. No direct SELECT for anyone.
-- (No policy = no access under RLS.)
