-- 0074_trade_reactions.sql
-- C4a: Reactions on trades. Three-reaction set: rocket, target, fire.
create table if not exists public.trade_reactions (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  reaction    text not null check (reaction in ('rocket','target','fire')),
  created_at  timestamptz not null default now(),
  unique (trade_id, user_id, reaction)
);

create index if not exists trade_reactions_trade_idx on public.trade_reactions(trade_id);
create index if not exists trade_reactions_user_idx  on public.trade_reactions(user_id);

alter table public.trade_reactions enable row level security;

create policy reactions_insert_visible
  on public.trade_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.trades t
      where t.id = trade_reactions.trade_id
        and (
          t.user_id = auth.uid()
          or t.visibility = 'public'
          or (
            t.visibility = 'followers_only'
            and exists (
              select 1 from public.subscriptions s
              where s.leader_id = t.user_id
                and s.follower_id = auth.uid()
            )
          )
        )
    )
  );

create policy reactions_select_visible
  on public.trade_reactions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_reactions.trade_id
        and (
          t.user_id = auth.uid()
          or t.visibility = 'public'
          or (
            t.visibility = 'followers_only'
            and exists (
              select 1 from public.subscriptions s
              where s.leader_id = t.user_id
                and s.follower_id = auth.uid()
            )
          )
        )
    )
  );

create policy reactions_delete_own
  on public.trade_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());
