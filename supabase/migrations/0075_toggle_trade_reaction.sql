-- get_trade_reactions: counts per reaction + which ones the caller has set.
-- Relies on trade_reactions RLS, so it only returns data for trades the caller can see.
create or replace function public.get_trade_reactions(p_trade_id uuid)
returns table (
  reaction text,
  count    bigint,
  reacted  boolean
)
language sql
stable
security invoker
as $$
  select
    r.reaction,
    count(*) as count,
    bool_or(r.user_id = auth.uid()) as reacted
  from public.trade_reactions r
  where r.trade_id = p_trade_id
  group by r.reaction
$$;

-- toggle_trade_reaction: add the reaction if absent, remove it if present.
-- Returns the updated reaction summary for the trade.
-- RLS on trade_reactions enforces that the caller can only react to visible trades
-- (insert policy) and only delete their own reaction (delete policy).
create or replace function public.toggle_trade_reaction(
  p_trade_id uuid,
  p_reaction text
)
returns table (
  reaction text,
  count    bigint,
  reacted  boolean
)
language plpgsql
volatile
security invoker
as $$
begin
  if p_reaction not in ('rocket','target','fire') then
    raise exception 'invalid reaction: %', p_reaction;
  end if;

  if exists (
    select 1 from public.trade_reactions
    where trade_id = p_trade_id
      and user_id = auth.uid()
      and reaction = p_reaction
  ) then
    delete from public.trade_reactions
    where trade_id = p_trade_id
      and user_id = auth.uid()
      and reaction = p_reaction;
  else
    insert into public.trade_reactions (trade_id, user_id, reaction)
    values (p_trade_id, auth.uid(), p_reaction);
  end if;

  return query
    select
      r.reaction,
      count(*)::bigint as count,
      bool_or(r.user_id = auth.uid()) as reacted
    from public.trade_reactions r
    where r.trade_id = p_trade_id
    group by r.reaction;
end;
$$;
