-- =============================================================================
-- 0038_account_scores_readonly_rls.sql
--
-- 0023 enabled RLS on account_scores but added permissive INSERT and UPDATE
-- policies that let any authenticated user write rows where user_id =
-- auth.uid(). The UI never exposed that surface, but a direct REST call
-- (e.g. `curl ${SUPABASE_URL}/rest/v1/account_scores`) could set arbitrary
-- pro_score / active_score and climb the leaderboard.
--
-- All legitimate writes come from the cron + manual recalculation paths,
-- which both go through supabaseAdmin() / service-role and bypass RLS.
-- So the fix is forward-only: drop the writable policies. SELECT stays
-- scoped to the row owner via the unchanged scores_self_select policy.
-- =============================================================================

DROP POLICY IF EXISTS scores_self_insert ON public.account_scores;
DROP POLICY IF EXISTS scores_self_update ON public.account_scores;

-- scores_self_select kept as-is: users can read their own score row.
-- Service-role writes (cron / recalculate-scores) bypass RLS and continue
-- to work via recalculateAccountScoreWithClient.
