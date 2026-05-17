# Claude Build Brief: First-Time Onboarding and Activation

Date: 2026-05-17
Owner workflow: Codex/Gemini requirements -> Codex architecture -> Claude build -> Codex QA -> Claude fixes -> Codex final audit
Target app: `web/` Next.js + Supabase BigMarkt Trade Journal

## Goal

Upgrade the first-time user journey so a new trader reaches clear product value within 5 minutes:

1. completes basic profile setup,
2. chooses manual or automated journaling,
3. lands on an activation dashboard with the next best action,
4. logs or connects enough data to see useful metrics,
5. understands the path toward verified performance and public proof.

This is an activation build, not a broad redesign. Do not add unrelated features.

## Product Thesis

BigMarkt should feel valuable as soon as a trader sees their first real performance signal. The onboarding should steer users into one of two primary activation paths:

- Manual path: set identity -> choose manual journal -> log first trade -> see dashboard/analytics movement.
- Automated path: set identity -> choose automated journal -> create/connect broker account or EA setup -> understand that verified data unlocks trust badges and stronger public proof.

The product should avoid dumping first-time users into a large navigation surface with no guidance.

## Current State

Existing implementation already includes:

- `web/app/onboarding/page.tsx`
  - Auth-gated onboarding route.
  - Loads profile fields: `display_name`, `username`, `journal_mode`, `visibility`.
- `web/app/onboarding/OnboardingWizard.tsx`
  - Three steps: identity, journal mode, visibility.
  - Saves each step via server actions.
  - Finishes by routing to `/dashboard`.
- `web/app/onboarding/actions.ts`
  - Username availability.
  - Step saves.
  - Skip flow.
- `web/app/(app)/dashboard/page.tsx`
  - Shows core metrics and recent trades.
  - Loads `trades`, `profiles`, and `broker_accounts`.
- `web/app/(app)/dashboard/Banners.tsx`
  - Dismissible localStorage banners for first manual trade or automated broker connection.
- `web/app/(app)/journal/new/page.tsx`
  - Existing new trade form.
- `web/app/(app)/accounts/page.tsx`
  - Broker account management.
- `web/app/(app)/ea-setup/page.tsx`
  - EA setup path.

Current weakness:

- The onboarding wizard captures preferences but does not create enough momentum.
- Dashboard banners are helpful but too light for first activation.
- There is no persistent server-side activation checklist.
- Dismissal is local-only, so activation state is not durable across devices.
- New users may not know which path produces value fastest.

## Non-Goals

- Do not rebuild auth.
- Do not redesign the whole dashboard.
- Do not add a new billing/paywall flow.
- Do not change Supabase RLS behavior except for narrowly scoped profile activation fields.
- Do not remove existing routes or navigation.
- Do not implement exchange syncing in this build.

## Success Criteria

The build is successful when:

- A newly signed-in user who has not completed activation sees a focused activation surface after onboarding.
- Manual users are pushed to log a first trade and then see that step marked complete.
- Automated users are pushed to add/connect an account or continue to EA setup.
- Profile identity and visibility steps remain saved as they are today.
- Activation state is computed from real data where possible, not only from localStorage.
- Users can skip/dismiss guidance, but the core checklist remains available until complete.
- Existing dashboard metrics and nav continue to work.
- Tests cover activation-state logic.

## Recommended Architecture

Add a small activation layer instead of bloating `DashboardPage`.

### New Server Helper

Create `web/lib/activation.ts`.

Responsibility:

- Given a user/profile/trade/account summary, compute activation steps.
- Return serializable data for dashboard and onboarding UI.
- Keep business rules testable without rendering Next pages.

Suggested types:

```ts
export type ActivationStepKey =
  | "profile"
  | "journal_mode"
  | "first_trade"
  | "connect_account"
  | "ea_setup"
  | "first_insight"
  | "public_profile";

export type ActivationPath = "manual" | "automated";

export type ActivationStep = {
  key: ActivationStepKey;
  title: string;
  body: string;
  href: string;
  complete: boolean;
  optional?: boolean;
};

export type ActivationSummary = {
  path: ActivationPath;
  completeCount: number;
  totalCount: number;
  percent: number;
  nextStep: ActivationStep | null;
  steps: ActivationStep[];
};
```

Core rules:

- `profile` complete when profile has `display_name` and `username`.
- `journal_mode` complete when `journal_mode` is `manual` or `automated`.
- Manual path:
  - `first_trade` complete when trade count is greater than 0.
  - `first_insight` complete when trade count is greater than 0. Keep it separate in UI copy, but compute complete from real first trade for now.
  - `public_profile` optional, complete when profile visibility is `public` or `community`.
- Automated path:
  - `connect_account` complete when broker account count is greater than 0.
  - `ea_setup` complete when there is an EA token or broker/EA connection signal if available. If the current schema query is not obvious, mark complete when broker account count is greater than 0 and keep the step copy pointed to `/ea-setup`.
  - `first_trade` complete when trade count is greater than 0.
  - `public_profile` optional, complete when profile visibility is `public` or `community`.

### Dashboard Component

Create `web/app/(app)/dashboard/ActivationPanel.tsx`.

Responsibility:

- Render a compact, persistent activation checklist above metrics.
- Show progress count and next action.
- Use existing visual language: `Section`, `StatusPill`, existing rounded-md/8px-ish surfaces.
- Avoid marketing hero styling.

Behavior:

- If activation is incomplete, show the panel.
- If activation is complete, hide the panel or show a very small success state with a link to analytics/report card.
- Each row shows complete/incomplete state, title, short body, and action link.
- Primary CTA points to `summary.nextStep.href`.
- Do not use browser localStorage as source of truth for completion.

### Dashboard Integration

Modify `web/app/(app)/dashboard/page.tsx`.

Add queries as needed:

- Existing profile query already fetches `*`; acceptable for now.
- Existing trades query already loads rows.
- Existing broker account count exists.
- If using EA token count, query `ea_tokens` scoped by `user_id`; verify table shape in migrations before implementing.

Then:

- Import `buildActivationSummary` from `web/lib/activation.ts`.
- Import `ActivationPanel`.
- Compute summary from profile/trades/account counts.
- Render `ActivationPanel` above `Banners`.

Keep `Banners` for lightweight nudges, but avoid duplicate messages. If `ActivationPanel` covers the same first action, either:

- hide `Banners` until activation is complete, or
- remove the duplicate first-trade/connect-broker banner logic.

Recommendation: keep `Banners` but render it below the activation panel only after activation is mostly complete, or simplify it in this build.

### Onboarding Wizard Upgrade

Modify `web/app/onboarding/OnboardingWizard.tsx`.

Keep the existing 3 steps, but tighten the final transition:

- Step 2 manual card copy should say that the next action is logging the first trade.
- Step 2 automated card copy should say that the next action is connecting account/EA.
- Step 3 should explain visibility as proof/profile readiness, not generic privacy only.
- Finish button copy should be path-aware:
  - Manual: `Go log first trade`
  - Automated: `Go connect account`
- On finish:
  - Manual users can route to `/journal/new` or `/dashboard?activation=1`.
  - Automated users can route to `/ea-setup` or `/dashboard?activation=1`.

Recommendation: route both to `/dashboard?activation=1` so every user sees the same activation hub first. The panel then sends them to the correct next action.

### Optional Profile Field

If Claude needs durable dismiss/complete state beyond computed facts, add this later, not in the first pass:

- `profiles.activation_dismissed_at timestamptz`
- `profiles.activation_completed_at timestamptz`

For this build, prefer computed state. It is safer and avoids unnecessary migration risk.

## Exact File Plan

### Create `web/lib/activation.ts`

Implement pure activation logic.

Inputs should be simple, not Supabase row types:

```ts
type BuildActivationInput = {
  displayName: string | null;
  username: string | null;
  journalMode: "manual" | "automated" | "hybrid" | null;
  visibility: "private" | "community" | "public" | string | null;
  tradeCount: number;
  brokerAccountCount: number;
  eaTokenCount?: number;
};
```

Export:

- `buildActivationSummary(input: BuildActivationInput): ActivationSummary`

### Create `web/app/(app)/dashboard/ActivationPanel.tsx`

Render-only component.

Props:

```ts
type Props = {
  summary: ActivationSummary;
};
```

Use icons from `lucide-react`:

- `CheckCircle2`
- `Circle`
- `ArrowRight`
- `Zap`

Do not add a new design system dependency.

### Modify `web/app/(app)/dashboard/page.tsx`

- Import helper and panel.
- Build summary.
- Render panel before `Banners`.
- Pass existing `journalMode`, `brokerAccountCount`, and `trades.length`.

### Modify `web/app/onboarding/OnboardingWizard.tsx`

- Adjust copy.
- Make finish button path-aware.
- Keep server actions unchanged unless needed.
- Prefer routing to `/dashboard?activation=1`.

### Add Tests

Create `web/tests/activation.spec.ts`.

Cover:

- Manual user with no trades has next step `first_trade`.
- Manual user with trades has first trade complete.
- Automated user with no account has next step `connect_account`.
- Automated user with account and no trades has next step `ea_setup` or `first_trade` depending on chosen rule.
- Percent is stable and never above 100.
- Public/community profile completes `public_profile`; private does not.

Run:

```bash
cd web
npm test -- activation.spec.ts
npm run typecheck
```

## UX Requirements

Activation panel should be compact and operational:

- No oversized hero section.
- No nested cards.
- No marketing copy blocks.
- Use one clear primary CTA.
- Checklist rows should be scannable.
- Copy should use trader language:
  - "Log your first trade"
  - "Connect your trading account"
  - "Unlock your first performance insight"
  - "Prepare your public proof profile"

Suggested panel structure:

- Header: `Activation`
- Subtext: `Complete the setup path that gets your journal useful.`
- Progress: `2 of 5 complete`
- Primary CTA: next step link
- Checklist rows below

## Acceptance Tests for Claude

Manual path:

1. Create/sign in as a user with `journal_mode = manual` and zero trades.
2. Visit `/dashboard`.
3. Activation panel appears.
4. Primary CTA points to `/journal/new`.
5. Add a trade.
6. Return to `/dashboard`.
7. First-trade step is complete and metrics reflect the trade.

Automated path:

1. Create/sign in as a user with `journal_mode = automated` and zero broker accounts.
2. Visit `/dashboard`.
3. Activation panel appears.
4. Primary CTA points to `/accounts` or `/ea-setup`.
5. Add broker account.
6. Return to `/dashboard`.
7. Account connection step is complete and next step is trade capture/EA setup.

Regression:

1. Existing dashboard metrics still render.
2. Existing onboarding still saves display name, username, journal mode, and visibility.
3. Existing `Banners` do not duplicate the same CTA directly above/below the activation panel.
4. `npm test` passes.
5. `npm run typecheck` passes.

## QA Notes for Codex After Claude Build

Codex should audit:

- Pure activation logic test coverage.
- No accidental exposure of private trade/account data.
- No client component importing server-only Supabase helpers.
- No hard dependency on localStorage for activation completion.
- Onboarding redirect behavior for both manual and automated paths.
- Mobile layout of activation panel.
- Whether automated path copy overpromises if EA setup cannot actually verify completion yet.

## Suggested Commit Message

```bash
git commit -m "feat: add first-time activation flow"
```
