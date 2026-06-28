-- 0075_toggle_trade_reaction.sql
-- C4a reactions: final reconciled definitions (definer + cnt + single-select).
-- Reconciles the repo with prod after live debugging on 2026-06-28.

-- Reader: counts per reaction + whether the caller reacted. SECURITY DEFINER so
-- it reads back reliably and so anon can read counts on public trades.
drop function if exists public.get_trade_reactions(uuid);

create function public.get_trade_reactions(p_trade_id uuid)
returns table (reaction text, cnt bigint, reacted boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_can_see boolean;
begin
  select exists (
    select 1 from public.trades t
    where t.id = p_trade_id
      and (
        t.visibility = 'public'
        or (v_uid is not null and t.user_id = v_uid)
        or (
          v_uid is not null
          and t.visibility = 'followers_only'
          and exists (
            select 1 from public.subscriptions s
            where s.leader_id = t.user_id and s.follower_id = v_uid
          )
        )
      )
  ) into v_can_see;

  if not v_can_see then
    return;
  end if;

  return query
    select tr.reaction, count(*)::bigint as cnt, bool_or(tr.user_id = v_uid) as reacted
    from public.trade_reactions tr
    where tr.trade_id = p_trade_id
    group by tr.reaction;
end;
$$;

grant execute on function public.get_trade_reactions(uuid) to anon, authenticated;

-- Toggle: single reaction per user per trade. SECURITY DEFINER with an explicit
-- visibility guard. Clicking your current reaction removes it; clicking a
-- different one replaces it.
drop function if exists public.toggle_trade_reaction(uuid, text);

create function public.toggle_trade_reaction(p_trade_id uuid, p_reaction text)
returns table (out_reaction text, out_cnt bigint, out_reacted boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_can_see boolean;
  v_already boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_reaction not in ('rocket','target','fire') then
    raise exception 'invalid reaction: %', p_reaction;
  end if;

  select exists (
    select 1 from public.trades t
    where t.id = p_trade_id
      and (
        t.user_id = v_uid
        or t.visibility = 'public'
        or (
          t.visibility = 'followers_only'
          and exists (
            select 1 from public.subscriptions s
            where s.leader_id = t.user_id and s.follower_id = v_uid
          )
        )
      )
  ) into v_can_see;

  if not v_can_see then
    raise exception 'trade not visible to user';
  end if;

  select exists (
    select 1 from public.trade_reactions tr
    where tr.trade_id = p_trade_id and tr.user_id = v_uid and tr.reaction = p_reaction
  ) into v_already;

  delete from public.trade_reactions tr
  where tr.trade_id = p_trade_id and tr.user_id = v_uid;

  if not v_already then
    insert into public.trade_reactions (trade_id, user_id, reaction)
    values (p_trade_id, v_uid, p_reaction);
  end if;

  return query
    select tr.reaction, count(*)::bigint, bool_or(tr.user_id = v_uid)
    from public.trade_reactions tr
    where tr.trade_id = p_trade_id
    group by tr.reaction;
end;
$$;

grant execute on function public.toggle_trade_reaction(uuid, text) to authenticated;
