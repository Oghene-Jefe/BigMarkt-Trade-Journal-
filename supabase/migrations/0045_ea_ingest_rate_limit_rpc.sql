-- 0045_ea_ingest_rate_limit_rpc.sql
--
-- Closes audit finding H-7 (TOCTOU race in /api/ea/ingest rate limit).
--
-- The previous rate-limit pattern in route.ts was:
--   1. SELECT count(*) FROM abuse_log WHERE token_hash = $1 AND ...
--   2. IF count >= 60 → return 429
--   3. INSERT abuse_log row
--
-- Two concurrent HTTP/2 requests with the same Bearer can both observe
-- count < 60 at step 1, both reach step 3, both proceed past the limit.
-- A bursty attacker exploits this by parallelising N requests in the
-- same one-second window — the effective cap becomes 60 × N rather
-- than 60/min.
--
-- This RPC collapses steps 1 and 3 into a single transactional unit and
-- serialises callers for the same token_hash with a transaction-scoped
-- advisory lock. The lock matters: under READ COMMITTED, concurrent
-- transactions do not see each other's uncommitted INSERTs, so "INSERT
-- then count" alone is still raceable. With the per-token advisory lock,
-- one caller at a time claims a slot and reads the count for that token.
--
-- The caller receives the post-INSERT count and decides whether to
-- proceed (count <= limit) or return 429 (count > limit). Either way,
-- the abuse_log row stays — rejected requests still consume a slot
-- from the attacker's bucket. The cleanup cron (wired up in commit
-- 861db46) prunes rows older than 7 days, so the table doesn't grow
-- unbounded.
--
-- SECURITY DEFINER so it can write into abuse_log regardless of the
-- caller's RLS. EXECUTE granted only to service_role; the route uses
-- supabaseAdmin() (service role) to call it, never the user-session
-- client.
--
-- Idempotent: CREATE OR REPLACE. Safe to re-run.

DROP FUNCTION IF EXISTS public.ea_ingest_rate_check_and_log(text, int, int);

CREATE OR REPLACE FUNCTION public.ea_ingest_rate_check_and_log(
  p_token_hash text,
  p_limit      int,
  p_window_sec int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Serialise only this token's bucket. A global table lock would close
  -- the race too, but would let one noisy token stall every other EA.
  -- hashtextextended(text, seed) gives a stable signed bigint suitable
  -- for pg_advisory_xact_lock(bigint); the lock releases automatically
  -- when the RPC transaction ends.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_token_hash, 0));

  -- INSERT first to claim the slot, then count while still holding the
  -- token-scoped advisory lock. Concurrent calls for the same token wait
  -- here, so they see the committed rows from earlier callers before
  -- deciding whether the bucket is over the limit.
  INSERT INTO public.abuse_log (scope, token_hash)
  VALUES ('ea_ingest', p_token_hash);

  -- After the INSERT, count everything in the window — including the
  -- row we just wrote. The caller compares this to p_limit. If it's
  -- over the limit, the route returns 429; the row stays in the log
  -- so future requests in the window also see the over-cap count and
  -- are correctly rejected (sustained burst can't sneak through).
  SELECT count(*)::int INTO v_count
  FROM public.abuse_log
  WHERE scope = 'ea_ingest'
    AND token_hash = p_token_hash
    AND created_at >= now() - make_interval(secs => p_window_sec);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.ea_ingest_rate_check_and_log(text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.ea_ingest_rate_check_and_log(text, int, int) TO service_role;

COMMENT ON FUNCTION public.ea_ingest_rate_check_and_log IS
  'Atomic rate-limit check for /api/ea/ingest. Inserts an abuse_log row, '
  'then returns the count within the window. Caller returns 429 if the '
  'returned count exceeds the limit. Closes audit finding H-7 (TOCTOU).';
