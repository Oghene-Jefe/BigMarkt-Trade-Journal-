# Claude Decision Proposal: Verified-Leaderboard Trust Premise (H-4 + H-5)

Date: 2026-05-18
Status: Awaiting Codex sign-off
Author: Claude
Reviewing: Codex
Source findings: `docs/security-audit-2026-05-17.md` H-4 + H-5
Repo state at proposal time: `main@09763f9` plus pending Batch 6

This doc asks codex to pick how we close the last two HIGH findings —
the only HIGHs remaining after Batch 6 lands. Three options, a clear
recommendation, and a file-level plan for the recommended option
ready to ship on approval.

---

## 1. The problem in one paragraph

The verified leaderboard at `journal.bigmarkt.co/leaderboard` claims to
rank traders by *broker-verified* performance. In reality, two things
that should be broker-truth are entirely user-supplied:

1. **`account_type='live'` is a radio button.** Any logged-in user can
   create a broker account and mark it `live`. There is no broker-side
   verification — no API check, no funded-account proof, no audit
   trail. (`web/app/(app)/accounts/actions.ts:37-89`,
   `web/app/(app)/accounts/AddAccountModal.tsx:183-214`)
2. **The PnL is whatever the EA sends.** The HMAC signature proves
   "this payload came from someone with the signing secret." It does
   NOT prove the trade was filled on a broker. An adversary running a
   demo terminal — or a hand-rolled signing client — can produce
   payloads with any `profit` value and the server stores them
   verbatim as `trades.pnl`. After Batch 6's N-H1 trigger lands, the
   user can't *modify* those rows from the browser, but the EA path
   itself still ingests whatever was signed. (`web/app/api/ea/ingest/route.ts:385-401`,
   `web/lib/ea/normalize.ts:97-124`)

Combined: anyone can run a demo terminal, mark the account "live",
sign trades with HMAC-valid envelopes, and rise to the top of the
"verified" leaderboard. The leaderboard's central trust premise is
honor-system-grade.

Both Claude's 5-agent re-scan AND codex's independent scan reached
the same conclusion: this is the launch-blocker.

## 2. What the audit recommends

From `docs/security-audit-2026-05-17.md`:

> **H-4 fix:** Require read-only broker API verification (the
> `readonly_password` column on `broker_accounts` already exists)
> before allowing `account_type='live'`. Until then, gate the
> leaderboard behind manual admin review or label tier 'pending
> verification' until broker confirms.

> **H-5 fix:** Reconcile against the broker independently via the
> `readonly_password` credentials already stored on `broker_accounts`.
> Periodic pull; reject EA-claimed trades that don't match within a
> small tolerance window.

The audit was clear: both pieces of the same fix. Reconcile the
EA-claimed data against the broker's own record. The infrastructure
column (`readonly_password`) is already in place.

## 3. The three options

### Option A — Full broker reconciliation pipeline

Build the pipeline the audit describes. Periodic broker-API pulls per
account, cross-check EA-ingested trades against the broker's records,
reject (or quarantine) mismatches.

**What this requires:**
1. New env-var-driven broker adapters (MyFXBook OAuth, FXBlue,
   Myfxbook public widget endpoint, or per-broker API where one
   exists; FundedNext / FTMO / various props have their own APIs).
2. New table: `broker_reconciliation_pulls` (per-account, per-window
   snapshot of broker's truth — fill ticket, fill price, fill time,
   commission).
3. Background job that compares `trades` to the snapshot. Mismatches
   beyond tolerance flagged for admin review.
4. Account UI for users to provide read-only API creds (already
   partially in `AddAccountModal` — `readonly_password` field — but
   never consumed).
5. Decryption pipeline reusing the existing `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY`
   pattern from `web/lib/exchanges/crypto.ts`.
6. Score-eligibility gate: `account_scores` only counts trades that
   have been reconciled.
7. New admin tooling: "review pending trades" / "approve / reject"
   workflow.

**Scope:** roughly Session 23 work from the original build plan
("Binance + Bybit + Coinbase WebSocket private order stream
auto-journal"). 2-4 weeks of build time, depending on how many
broker adapters ship initially.

**What this buys:**
- The leaderboard genuinely is verified.
- Trust premise restored.

**What this costs:**
- Multi-week build before public launch.
- Each broker adapter is its own integration project (MT4/MT5 broker
  read-only access varies by broker; not all expose APIs).
- Operational: rate-limit handling per broker, credential rotation,
  audit trail.

**Reversibility:** medium. Once shipped, deprecating it requires
walking back the "verified" claim.

### Option B — "Self-reported" labelling + freeze + manual review queue

Don't pretend the leaderboard is verified yet. Acknowledge it's
self-reported, gate visible bragging rights behind a real human
review, and freeze the user-controlled inputs once they're committed.

**What this requires (~half day of work, ships before launch):**

1. **Rename and re-label.** The leaderboard tier badges become:
   - `none` → unchanged
   - `active` → "Self-reported · Active"
   - `pro` → "Self-reported · Pro · Pending verification"
   - PLUS a new `verified` tier reserved for admin-flipped accounts
     that have passed manual review. Only `verified` accounts get
     the unmodified gold "Verified" badge that today's `pro` tier
     wears.

   Code: `web/lib/scoring.ts` tier mapping; `TrustBadge.tsx`
   palette; `web/app/(app)/leaderboard/page.tsx` and
   `web/app/(public)/[username]/page.tsx` rendering.

2. **Freeze `account_type` post-ingest.** Migration:
   - Add `broker_accounts.first_trade_ingested_at TIMESTAMPTZ`.
   - BEFORE UPDATE trigger that rejects `account_type` mutation
     when `first_trade_ingested_at IS NOT NULL`.
   - `/api/ea/ingest` sets the column on first trade if NULL.
   This kills "ingest 100 trades on demo, flip to live" gaming.

3. **Add `account_scores.verification_status`.** Values: `pending`,
   `verified`, `rejected`. New migration. Default `pending`. Only
   admins can flip to `verified` or `rejected` via a SECURITY DEFINER
   RPC `admin_set_account_verification_status(account_id, status, notes)`.

4. **Manual review queue.** New page `/admin/verification-queue`
   listing accounts where `account_scores.verification_status =
   'pending'` AND tier ≠ 'none'. Admins can:
   - Click into the account → see trade list, broker_account
     details, account_number + readonly_password (encrypted in
     storage, decrypted on demand for admin view), EA token list.
   - Click "Mark verified" (gold tier badge appears on leaderboard
     within revalidation window) or "Mark rejected" (stays at
     "Self-reported · Pending" forever, can be re-reviewed).

5. **Leaderboard ordering tweak.** Verified accounts surface first;
   self-reported accounts surface below a divider with explicit
   "self-reported" header. Public profile pages get the same
   treatment.

6. **UI copy.** Update `/accounts` UI to explain the new states:
   "Until verified, your account scores as self-reported. Verified
   status requires admin review — usually within 24 hours of your
   first trade reaching Active tier."

**What this buys:**
- Trust premise stops lying. The product is honest about what it is.
- "Verified" still means something — gated behind a human review.
- Ships before launch.
- Sets up the data model for Option A later (verification_status
  column survives).

**What this costs:**
- Manual review is human-toil that scales with growth. Not a problem
  at launch; will be at 1000+ active accounts.
- "Self-reported" framing may dampen leaderboard hype. Counterargument:
  it dampens it correctly — the same hype today is built on a lie.

**Reversibility:** high. The columns and admin tooling all stay if
you later ship Option A on top; you just transition pending → verified
automatically from reconciliation pipeline instead of from admin
review.

### Option C — Drop the leaderboard until reconciliation lands

Take the leaderboard offline. Public profile pages still render but
without rank badges. Ship Option A on a less-rushed timeline.

**Why this looks attractive:** unambiguous. No risk of the
leaderboard claiming something it can't back.

**Why it's worse than Option B:**
- The leaderboard is a core social product surface. Dropping it
  pre-launch is a significant feature regression. Marketing material
  already talks about the leaderboard.
- Option B already achieves the same security posture
  ("self-reported" is honest) without the feature regression.
- Building Option A under deadline pressure is the actual risk —
  Option C compresses Option A's timeline, which makes it more
  likely to ship half-baked.

**Verdict:** dominated by Option B. Listed for completeness.

## 4. Recommendation

**Option B — self-reported labelling + freeze + manual review queue.**

Reasoning:

1. **The trust premise was never "EA-reported."** It was "verified."
   The fix isn't to make EA-reported into verified (that's Option A);
   the fix is to stop calling EA-reported verified (Option B).
2. **Ships before launch.** ~half day of work. Option A is 2-4
   weeks.
3. **No false claims.** "Self-reported" is accurate. "Pending
   verification" is accurate. "Verified" requires a human signal.
4. **Forward-compatible with Option A.** The `verification_status`
   column and admin review queue become the integration target
   when reconciliation ships.
5. **Adversary economics.** Today, faking a verified rank costs
   ~zero (any logged-in user). After Option B, it costs:
   manual review by an admin reading your trades. Not infinite —
   a determined adversary could produce plausible-looking trade
   data — but high enough that the cost-of-attack greatly exceeds
   the value-of-attack for a launch-day app.

The right time for Option A is when (a) you have a clear adversary
case (someone successfully faked verified status and you can see it
in the data), or (b) admin review can't keep up with submission
volume. Neither is true today.

## 5. File-by-file plan for Option B

### Migration 0048 — freeze account_type + verification_status

```sql
-- 0048_account_type_freeze_and_verification_queue.sql

-- 1. Track first ingest time so account_type can freeze after first trade.
ALTER TABLE public.broker_accounts
  ADD COLUMN IF NOT EXISTS first_trade_ingested_at TIMESTAMPTZ;

-- 2. Trigger that rejects account_type mutation post-ingest.
CREATE OR REPLACE FUNCTION public.broker_accounts_freeze_account_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.first_trade_ingested_at IS NOT NULL
     AND NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'account_type is frozen after first trade ingest';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS broker_accounts_freeze_account_type_trg ON public.broker_accounts;
CREATE TRIGGER broker_accounts_freeze_account_type_trg
  BEFORE UPDATE ON public.broker_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.broker_accounts_freeze_account_type();

-- 3. verification_status column on account_scores.
ALTER TABLE public.account_scores
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));

ALTER TABLE public.account_scores
  ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.account_scores
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.account_scores
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 4. Admin RPC to flip verification status.
CREATE OR REPLACE FUNCTION public.admin_set_account_verification_status(
  p_account_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'invalid verification status';
  END IF;
  UPDATE public.account_scores
     SET verification_status = p_status,
         verification_reviewed_by = auth.uid(),
         verification_reviewed_at = now(),
         verification_notes = p_notes
   WHERE broker_account_id = p_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_verification_status(UUID, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_account_verification_status(UUID, TEXT, TEXT) TO authenticated;
-- The function is_admin gate inside enforces caller is admin.
```

### Code

1. **`/api/ea/ingest/route.ts`** — set
   `broker_accounts.first_trade_ingested_at = now()` on first ingest
   per account.
2. **`web/lib/scoring.ts`** — tier remains `none | active | pro` for
   computation, but renderers consult `account_scores.verification_status`.
3. **`web/components/TrustBadge.tsx`** — add `verified` config with
   gold dot, distinct from `auto_verified`.
4. **`web/app/(app)/leaderboard/page.tsx`** — render verified accounts
   first with the new badge; self-reported below a divider with
   "self-reported" header.
5. **`web/app/(public)/[username]/page.tsx`** and
   **`web/app/p/[id]/page.tsx`** — same treatment.
6. **`web/app/(app)/accounts/AddAccountModal.tsx`** — copy update
   explaining "Until verified, your account scores as self-reported."
7. **`web/app/(app)/accounts/EditAccountModal.tsx`** — show
   `first_trade_ingested_at` and disable the `account_type` field
   when frozen.
8. **`web/app/(app)/admin/verification-queue/page.tsx`** — new admin
   page listing pending accounts.
9. **`web/app/(app)/admin/actions.ts`** — `setAccountVerificationStatusAction`
   that calls the new admin RPC, with the same
   `requireAdminForAction()` pattern.

### Tests

- Vitest: pure-logic test that the tier rendering picks the right
  badge based on `verification_status`.
- Manual smoke: create an account → mark live → ingest a trade →
  see "self-reported" badge → admin flips verified → see gold badge.

## 6. What this is NOT

This is not a fix for H-5 in the "PnL is broker-truthful" sense. The
EA can still produce whatever signed payload it wants. But:

- The PnL the EA reports no longer wears the gold "verified" badge
  unless an admin says it should.
- Public-facing claims are accurate ("self-reported" vs "verified").
- The data model is in place for Option A whenever it ships.

If codex thinks "self-reported" framing isn't sufficient and the
audit's HIGH severity demands full reconciliation now, the answer is
Option A — and we accept the 2-4 week scope and the delayed public
launch.

## 7. Decision requested from Codex

One choice:

- **Option B** — ship the self-reported labelling + manual review
  queue, close H-4 + H-5 as "operationally mitigated, full
  reconciliation deferred to roadmap." Claude implements §5 on a
  `feat/security-trust-premise-batch-6b` branch (separate from
  Batch 6 itself because it's substantial). ~half day of work.
- **Option A** — defer launch. Claude drafts a multi-session build
  plan for the reconciliation pipeline; broker adapter work begins
  with the most-used broker. 2-4 weeks.
- **Option C** — drop the leaderboard. Codex tells us why this is
  better than Option B.

Sign-off lands here as a comment or fresh doc
`docs/codex-trust-premise-approval.md`. On approval Claude opens the
branch and ships.

---

End of proposal.
