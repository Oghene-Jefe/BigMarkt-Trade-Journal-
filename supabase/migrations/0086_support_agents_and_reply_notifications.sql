-- 0086_support_agents_and_reply_notifications.sql
--
-- Support desk (owner decision 2026-09-22):
--   1. A support-only role that can read and answer trader support messages
--      WITHOUT access to trades, balances, payouts or admin tooling.
--   2. An in-app notification for the trader when support replies.
--
-- Applied MANUALLY in the Supabase SQL Editor — staging first, then live.
-- Safe to re-run.

-- 1. Who is a support agent --------------------------------------------------

create table if not exists public.support_agents (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.support_agents enable row level security;
-- No policies on purpose. The table is read only through is_support_agent()
-- (SECURITY DEFINER) and written by an admin in the SQL editor:
--   insert into support_agents (user_id) values ('<auth.users id>');

-- Admins keep support access, so an admin never loses the inbox.
create or replace function public.is_support_agent(uid uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.support_agents a  where a.user_id  = uid)
      or exists (select 1 from public.admin_users    ad where ad.user_id = uid);
$$;

grant execute on function public.is_support_agent(uuid) to authenticated;

-- 2. Support tables: agents read every conversation, reply, and set status ---

drop policy if exists support_agents_select_conversations on public.support_conversations;
create policy support_agents_select_conversations on public.support_conversations
  for select using (public.is_support_agent(auth.uid()));

drop policy if exists support_agents_update_conversations on public.support_conversations;
create policy support_agents_update_conversations on public.support_conversations
  for update using (public.is_support_agent(auth.uid()))
  with check (public.is_support_agent(auth.uid()));

drop policy if exists support_agents_select_messages on public.support_messages;
create policy support_agents_select_messages on public.support_messages
  for select using (public.is_support_agent(auth.uid()));

-- An agent can only post as support, and only as themselves.
drop policy if exists support_agents_insert_messages on public.support_messages;
create policy support_agents_insert_messages on public.support_messages
  for insert with check (
    public.is_support_agent(auth.uid())
    and sender_role = 'admin'
    and sender_id = auth.uid()
  );

-- 3. The only trader details an agent may see: name, email, join date --------
-- profiles RLS stays self + admin. This function is the narrow window: no
-- balances, no plan, no referral data, and only for people who actually have
-- one of the given conversations.

create or replace function public.support_people(p_conversation_ids uuid[])
returns table (
  user_id      uuid,
  email        text,
  username     text,
  display_name text,
  member_since timestamptz
)
language sql stable security definer set search_path to 'public'
as $$
  select p.id, p.email, p.username, p.display_name, p.created_at
  from public.profiles p
  where public.is_support_agent(auth.uid())
    and p.id in (
      select c.user_id
      from public.support_conversations c
      where c.id = any (p_conversation_ids)
    );
$$;

grant execute on function public.support_people(uuid[]) to authenticated;

-- 4. Tell the trader in-app when support replies -----------------------------

-- notifications.type is a fixed list; add the support reply type.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'leader_suspended'::text,
    'leader_under_review'::text,
    'leader_inactive'::text,
    'leader_reinstated'::text,
    'score_updated'::text,
    'dispute_opened'::text,
    'dispute_resolved'::text,
    'subscription_cancelled'::text,
    'new_follower'::text,
    'announcement'::text,
    'trade_approved'::text,
    'challenge_badge'::text,
    'support_reply'::text
  ])
);

create or replace function public.notify_user_on_support_reply()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid;
begin
  if new.sender_role <> 'admin' then
    return new;
  end if;

  select c.user_id into v_user
  from public.support_conversations c
  where c.id = new.conversation_id;

  if v_user is null then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body)
  values (
    v_user,
    'support_reply',
    'BigMarkt support replied',
    left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 140)
  );

  return new;
end;
$$;

-- Runs alongside the existing on_new_support_message trigger.
drop trigger if exists on_support_reply_notify on public.support_messages;
create trigger on_support_reply_notify
after insert on public.support_messages
for each row execute function public.notify_user_on_support_reply();
