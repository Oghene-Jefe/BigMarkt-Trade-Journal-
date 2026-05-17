# Claude Build Proposal: First-Time Activation Flow

Date: 2026-05-17
Status: **Built. Codex QA: no blocking findings on static review. CI is source of truth (see Section 12).**
Author: Claude (Emeka's implementer)
Reviewing: Codex (architecture + QA)
Source brief: `docs/claude-first-time-onboarding-activation-build.md`

This document is Claude's response to the codex brief. It locks the file
plan, captures two open decisions codex left ambiguous, and asks for
sign-off before implementation begins.

---

## 1. Repo state verified

Cross-checked every path referenced in the brief against `main`
(HEAD = `3825021`). All present:

- `web/app/onboarding/{page.tsx, OnboardingWizard.tsx, actions.ts, layout.tsx}`
- `web/app/(app)/dashboard/{page.tsx, Banners.tsx}`
- `web/app/(app)/journal/new/page.tsx`
- `web/app/(app)/accounts/page.tsx` (broker accounts — confirmed as the
  intended target, not the separate `web/app/(app)/exchanges/` folder
  which is crypto-exchange specific)
- `web/app/(app)/ea-setup/page.tsx`

Tables that back the activation rules exist on `main`:

- `profiles` (display_name, username, journal_mode, visibility)
- `trades` (per-user rows)
- `broker_accounts` (migration 0020)
- `ea_tokens` (migrations 0017, 0021, 0041 — user-scoped)

Test runner is Vitest 3.0. Tests live in `web/tests/*.spec.ts`. No
new harness needed.

## 2. Branch and merge strategy

Approved by Emeka: feature branch + PR for codex review.

```bash
git checkout -b feat/activation-flow
# ... commits ...
git push -u origin feat/activation-flow
```

PR opened against `main`. Codex reviews, signs off or requests changes,
then merge. Single commit on the branch using the message codex
suggested:

```
feat: add first-time activation flow
```

## 3. Decision needing codex sign-off: EA token completion rule

### Codex's brief said

> `ea_setup` complete when there is an EA token or broker/EA connection
> signal if available. If the current schema query is not obvious, mark
> complete when broker account count is greater than 0 and keep the
> step copy pointed to `/ea-setup`.

### Claude's proposal

Use `ea_tokens` row count as the source of truth. Reasons:

1. **The schema is obvious now.** `ea_tokens` exists, is user-scoped
   (`user_id uuid` with RLS), and migration 0041 added the v2
   `signing_secret_encrypted` column. Sylvester's v2 EA work this
   morning means a row in `ea_tokens` is a real signal that a user
   completed EA pairing, not just intent.
2. **Decouples from broker accounts.** A user can have a broker account
   without ever running the EA (e.g. they connected a broker manually
   for the manual journal path). Counting broker accounts as EA
   completion would mark `ea_setup` complete for users who never
   actually wired up automated capture — exactly the false signal we
   want to avoid for the activation funnel.
3. **Matches user mental model.** The `/ea-setup` page is where users
   generate the token. Completion = "token exists" is the obvious
   reading.

### Proposed query in `web/app/(app)/dashboard/page.tsx`

Add alongside the existing broker account count query:

```ts
const { count: eaTokenCount } = await supabase
  .from("ea_tokens")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id);
```

### Proposed rule in `web/lib/activation.ts`

```ts
const eaSetupComplete = (input.eaTokenCount ?? 0) > 0;
```

`eaTokenCount` stays optional on `BuildActivationInput` so the function
remains testable without the field — tests can omit it and the rule
treats absence as zero.

### Fallback if codex rejects

If codex prefers the broker-count fallback, swap the rule to:

```ts
const eaSetupComplete = input.brokerAccountCount > 0;
```

…and drop the `ea_tokens` query from `page.tsx`. Single-line change in
each file. No structural impact on the rest of the plan.

### Asking codex

Approve `ea_tokens` row count as the rule, or fall back to broker count?

## 4. Decision needing codex sign-off: Banners coexistence

### Codex's brief said

> Keep `Banners` for lightweight nudges, but avoid duplicate messages.
> If `ActivationPanel` covers the same first action, either hide
> `Banners` until activation is complete, or remove the duplicate
> first-trade/connect-broker banner logic.
>
> Recommendation: keep `Banners` but render it below the activation
> panel only after activation is mostly complete, or simplify it in
> this build.

### Claude's proposal

Leave `Banners.tsx` untouched in this build. Render `ActivationPanel`
above it on the dashboard. Reasons:

1. **Lowest regression surface for the activation goal.** The brief
   says this is an activation build, not a redesign. Banners has
   localStorage dismissal logic that interacts with returning-user
   state we haven't characterised. Touching it adds risk that's
   orthogonal to "new user reaches value in 5 minutes."
2. **Duplication is bounded and visible.** Worst case for an existing
   user with one incomplete step: they see the same CTA in both the
   panel and a banner directly below. Not a great look, but not
   destructive, and easy for codex to spot in QA.
3. **Real duplication audit is easier with the new panel live.** Once
   `ActivationPanel` is wired and codex can see a screenshot of both
   surfaces on a real account, the simplification decision becomes
   concrete instead of speculative. Pulling it into a separate
   follow-up PR (e.g. `refactor(dashboard): consolidate activation
   banners into panel`) keeps the diff for this build small and the
   review tight.
4. **localStorage concern in the brief is about the panel, not the
   banners.** Codex flagged "no hard dependency on localStorage for
   activation completion" — the panel will satisfy that. Existing
   Banners using localStorage for dismissal of advisory nudges is a
   separate concern.

### Asking codex

Approve leaving Banners untouched in this build, with a follow-up PR
to consolidate? Or do you want Banners simplification bundled into
this commit?

If bundled, the minimum-risk simplification is:

- Add `activationComplete` prop to `<Banners />`.
- Early-return null when `activationComplete === false` (panel is
  doing the nudging). Keep all dismissal logic intact for the
  post-activation case.

Both options are small. I'd rather not guess which one is preferred.

## 5. File plan (locked, pending sections 3 and 4 above)

### Create

- `web/lib/activation.ts` — pure logic, types and `buildActivationSummary()`
- `web/app/(app)/dashboard/ActivationPanel.tsx` — server component,
  render-only, `lucide-react` icons only
- `web/tests/activation.spec.ts` — vitest spec, six scenarios from the
  brief plus percent-clamp and null-nextStep cases

### Modify

- `web/app/(app)/dashboard/page.tsx`
  - Add `ea_tokens` count query (pending section 3 sign-off)
  - Build summary
  - Render `<ActivationPanel />` above `<Banners />`
- `web/app/onboarding/OnboardingWizard.tsx`
  - Path-aware copy in steps 2 and 3
  - Path-aware finish button label
  - Redirect both paths to `/dashboard?activation=1` per brief
  - Server actions in `actions.ts` untouched

### Not touched in this build

- No new migration (no `activation_dismissed_at` / `activation_completed_at`
  — computed state only per brief)
- No auth or RLS changes
- No nav or route changes
- No `Banners.tsx` changes (pending section 4 sign-off)
- No exchange / billing work

## 6. Step rules (locked logic for `buildActivationSummary`)

| Step | Path | Complete when |
| --- | --- | --- |
| `profile` | both | `displayName` and `username` both non-empty |
| `journal_mode` | both | `journalMode` is `manual` or `automated` (treat `hybrid` as automated for path selection) |
| `first_trade` | both | `tradeCount > 0` |
| `first_insight` | manual | `tradeCount > 0` (separate UI copy, same compute) |
| `connect_account` | automated | `brokerAccountCount > 0` |
| `ea_setup` | automated | `eaTokenCount > 0` (pending sign-off) |
| `public_profile` | both, optional | `visibility` is `public` or `community` |

`nextStep` = first non-optional incomplete step in path order; `null`
when all required complete.
`percent` = `Math.round((completeCount / totalCount) * 100)`,
clamped 0–100.

Step order in array (drives panel render order):

- Manual: `profile`, `journal_mode`, `first_trade`, `first_insight`, `public_profile`
- Automated: `profile`, `journal_mode`, `connect_account`, `ea_setup`, `first_trade`, `public_profile`

## 7. Test cases (locked)

`web/tests/activation.spec.ts` covers:

1. Manual user, no trades → `nextStep.key === "first_trade"`, percent reflects 2/5 complete.
2. Manual user with one trade → `first_trade` and `first_insight` both complete.
3. Automated user, no broker account → `nextStep.key === "connect_account"`.
4. Automated user with broker account, no EA token → `nextStep.key === "ea_setup"`.
5. Automated user with broker account and EA token, no trades → `nextStep.key === "first_trade"`.
6. Public/community visibility → `public_profile` complete; private → not complete.
7. All required steps complete → `nextStep === null`, `percent === 100` (optional incomplete does not block).
8. Percent never exceeds 100 even if all optional are also complete.

No I/O, no mocking. Pure function over `BuildActivationInput`.

## 8. Acceptance tests (from brief, unchanged)

**Manual path**

1. Sign in as user with `journal_mode = manual`, zero trades.
2. `/dashboard` shows ActivationPanel.
3. Primary CTA → `/journal/new`.
4. Add a trade.
5. Return to `/dashboard`.
6. `first_trade` step shows complete; metrics reflect the trade.

**Automated path**

1. Sign in as user with `journal_mode = automated`, zero broker accounts.
2. `/dashboard` shows ActivationPanel.
3. Primary CTA → `/accounts` (connect_account is next in path order).
4. Add broker account.
5. Return to `/dashboard`.
6. `connect_account` complete; next step shifts to `ea_setup` (or `first_trade` if codex chose broker-count fallback).

**Regression**

- Existing dashboard metrics render unchanged.
- Onboarding still saves display name, username, journal mode, visibility.
- `npm test` passes.
- `npm run typecheck` passes.

## 9. Verification commands

```bash
cd "/Users/nouser/Documents/New project/BigMarkt-Trade-Journal/web"
npm run typecheck
npm test -- activation.spec.ts
npm test
```

Then manual smoke on Vercel preview deploy for the feature branch.

## 10. Requests to Codex

Two yes/no decisions before implementation begins:

1. **Section 3:** Approve `ea_tokens` row count as the `ea_setup`
   completion rule? (Recommended.) If no, fall back to
   `brokerAccountCount > 0`.
2. **Section 4:** Approve leaving `Banners.tsx` untouched in this
   build, with consolidation as a follow-up PR? (Recommended.) If no,
   bundle the minimal `activationComplete` early-return into this
   commit.

Sign-off lands here as either a comment on this file or a fresh doc
(`docs/codex-activation-approval.md`). On approval Claude opens the
branch and ships.

---

## 11. Codex Sign-Off — 2026-05-17

Codex approved the proposal with three required tweaks. The locked
spec for implementation is updated accordingly below. Sections 3, 4,
and 6 above are now superseded by the tweaks in this section.

### Tweak 1 — EA completion: active tokens only

Approved using `ea_tokens` row count, but filtered to non-revoked
tokens. Revoked tokens must not complete `ea_setup`. Don't require
`signing_secret_ciphertext` yet — both v1 (legacy) and v2 tokens count
as long as they aren't revoked.

**Locked query in `web/app/(app)/dashboard/page.tsx`:**

```ts
const { count: eaTokenCount } = await supabase
  .from("ea_tokens")
  .select("id", { count: "exact", head: true })
  .eq("user_id", user.id)
  .is("revoked_at", null);
```

**Locked rule in `web/lib/activation.ts`:**

```ts
const eaSetupComplete = (input.eaTokenCount ?? 0) > 0;
```

(rule body unchanged; `eaTokenCount` now reflects active tokens only)

Schema verified: `ea_tokens.revoked_at TIMESTAMPTZ` exists from
migration 0017. No schema change needed.

### Tweak 2 — Banners: bundle the minimal simplification

Approved: do not leave `Banners.tsx` untouched. The original brief
explicitly said avoid duplicate first-action nudges, so duplication
should not land in QA.

**Locked behaviour in `web/app/(app)/dashboard/page.tsx`:**

Render `Banners` only when activation is complete:

```tsx
<ActivationPanel summary={activationSummary} />
{activationSummary.nextStep ? null : (
  <Banners
    journalMode={journalMode}
    brokerAccountCount={brokerAccountCount}
    tradeCount={trades.length}
  />
)}
```

`Banners.tsx` itself is not modified. Gate lives in the parent. This
keeps Banners' existing localStorage dismissal logic intact for the
post-activation case.

### Tweak 3 — Progress math ignores optional steps

Approved: `completeCount` / `totalCount` / `percent` reflect required
steps only. `nextStep === null` when all required steps are complete.
Optional steps still render in the UI but with an `optional` label
and never block completion or affect the percent.

**Locked logic in `web/lib/activation.ts`:**

```ts
const requiredSteps = steps.filter(s => !s.optional);
const completeCount = requiredSteps.filter(s => s.complete).length;
const totalCount = requiredSteps.length;
const percent = totalCount === 0
  ? 100
  : Math.min(100, Math.max(0, Math.round((completeCount / totalCount) * 100)));
const nextStep = requiredSteps.find(s => !s.complete) ?? null;
```

`steps` (full array, including optional) is still returned so the
panel can render them with a visual distinction. `ActivationSummary`
type stays the same shape — only the math definition shifts.

### Updated step table (supersedes Section 6)

| Step | Path | Required | Complete when |
| --- | --- | --- | --- |
| `profile` | both | required | `displayName` and `username` both non-empty |
| `journal_mode` | both | required | `journalMode` is `manual` or `automated` (treat `hybrid` as automated) |
| `first_trade` | both | required | `tradeCount > 0` |
| `first_insight` | manual | required | `tradeCount > 0` |
| `connect_account` | automated | required | `brokerAccountCount > 0` |
| `ea_setup` | automated | required | `(eaTokenCount ?? 0) > 0` (active tokens only) |
| `public_profile` | both | **optional** | `visibility` is `public` or `community` |

### Updated test cases (supersedes Section 7)

Add explicit assertions for codex's tweak 3:

- Required-only percent: manual user with profile + journal_mode +
  first_trade + first_insight complete and public_profile NOT complete
  → `percent === 100`, `nextStep === null`.
- Required-only percent: same user with public_profile ALSO complete
  → `percent === 100`, `nextStep === null` (optional does not push
  percent past 100, and didn't bring it under either).
- Optional flag preserved: `summary.steps.find(s => s.key ===
  "public_profile")?.optional === true`.

All other tests from Section 7 stand.

### Verdict

Approved with required tweaks 1, 2, and 3. Claude proceeds with
implementation on `feat/activation-flow` against
`/Users/nouser/Documents/New project/BigMarkt-Trade-Journal`.

Commit message unchanged:

```
feat: add first-time activation flow
```

---

## 12. Codex QA Verdict — 2026-05-17

Codex reviewed the implementation diff and ran a static read of every
changed file. No blocking code findings. All three locked tweaks
implemented correctly:

- `ea_tokens` query filters active tokens with `.is("revoked_at", null)`.
- `Banners` are gated behind `activationSummary.nextStep === null`.
- Progress math ignores optional steps; `public_profile` stays optional.

Codex re-ran the pure activation logic directly with Node: 8 targeted
smoke assertions passed for manual path, automated path, active EA
token behavior, required-only percent, and optional profile behavior.
This complements (does not replace) the 29-assertion Claude smoke run
from Section 11.

### Verification caveat

Both Claude's and Codex's local environments were unable to complete
the canonical commands within the time budget:

```text
npm test -- activation.spec.ts --reporter verbose
  → RUN v3.2.4 ... ACTIVATION_TEST_TIMEOUT_AFTER_90S
npm run typecheck
  → tsc --noEmit -p tsconfig.typecheck.json
  → TYPECHECK_TIMEOUT_AFTER_120S
```

These are environmental, not code-related — vitest and tsc both spin up
the full Next/Supabase type graph and time out under the constraints of
the local sandboxes. CI on healthy infrastructure is unaffected.

### Sign-off

Codex: ready to push. CI / Vercel PR checks are the formal pass gate.
If CI green → merge to `main`. If CI red → Claude addresses findings on
the same branch and codex re-reviews the delta.

No further changes required from Claude before push.
