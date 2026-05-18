# BigMarkt Signup → Verification → Onboarding Workflow

Date: 2026-05-18
Status: Bug fix + reference doc. Verification email bug closed in same
commit as this doc.

## The bug we just fixed

`signupAction` was calling `supabase.auth.signUp()` without specifying
`emailRedirectTo`. Supabase fell back to the project's **Site URL**
setting (in Supabase Dashboard → Authentication → URL Configuration),
which is `https://bigmarkt.co` — the marketing site, which has no
auth-callback route. Users who clicked the verification link landed on
the marketing home page with no session created and no feedback that
verification succeeded.

`requestResetAction` was correctly specifying `redirectTo`, which is
why password-reset emails worked end-to-end. Signup was the only path
that fell through to the broken Site URL fallback.

**Fix:** signupAction now sets
`emailRedirectTo: <journal-origin>/auth/callback?next=/dashboard`.
The journal's `/auth/callback` route exchanges the PKCE code for a
session and forwards the user to `/dashboard`. The `(app)/layout.tsx`
auth gate then picks up the fresh session, sees an empty profile, and
forwards to `/onboarding`.

## End-to-end signup workflow (post-fix)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User visits /signup                                               │
│    web/app/(auth)/signup/page.tsx                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Fills form:                                                       │
│    - Name (required, max 80 chars)                                   │
│    - Email (required, RFC 5321 ≤254 chars, lowercased+trimmed)       │
│    - Password (≥12 chars per L-1)                                    │
│    - Referral code (optional, base64-shaped)                         │
│    - Honeypot 'website' field (hidden, must stay empty)              │
│    - Turnstile widget auto-solves (per L-2)                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Submit → signupAction (web/app/(auth)/actions.ts)                 │
│    a. Zod parses entire form including turnstile_token               │
│    b. Honeypot check — empty? else silently "Bot detected"           │
│    c. verifyTurnstile(token, ip) — fails CLOSED in prod              │
│    d. trustedAppOrigin() — env-locked allow-list, can't be spoofed   │
│    e. supabase.auth.signUp({                                         │
│         email, password,                                             │
│         options: {                                                   │
│           data: { name, referred_by? },                              │
│           emailRedirectTo: '<origin>/auth/callback?next=/dashboard'  │
│         }                                                            │
│       })                                                             │
│    f. If error → generic "Signup failed. Try again."                 │
│    g. If existing email (data.user.identities.length === 0)          │
│       → "This email already has an account — log in instead."        │
│       (UX trade-off: re-opens enumeration; doc'd as N-H6 revert)     │
│    h. If new email → return                                          │
│       { ok: "Check your inbox at X to verify your account." }        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Supabase queues a verification email (via the Auth email          │
│    template configured in Supabase Dashboard).                       │
│                                                                      │
│    Email body's {{ .ConfirmationURL }} placeholder resolves to:      │
│      https://journal.bigmarkt.co/auth/callback                       │
│        ?next=/dashboard                                              │
│        &code=<pkce-confirmation-code>                                │
│                                                                      │
│    (Pre-fix: this resolved to https://bigmarkt.co/?... — broken.)    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. User clicks the link in their email                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. /auth/callback GET handler                                        │
│    web/app/auth/callback/route.ts                                    │
│    a. Parses 'code' and 'next' query params                          │
│    b. Validates 'next' against ALLOWED_NEXT allow-list (M-17):       │
│       /dashboard, /journal, /profile, /onboarding, /reset/confirm    │
│       — anything else falls back to /dashboard                       │
│    c. supabase.auth.exchangeCodeForSession(code)                     │
│       → Supabase sets the auth cookie on this response               │
│    d. Returns 302 redirect to next URL                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Browser follows redirect to /dashboard                            │
│    (cookie from step 6c authenticates the request)                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. (app)/layout.tsx auth + onboarding gate (H-12 fix)                │
│    web/app/(app)/layout.tsx                                          │
│    a. supabase.auth.getUser() — succeeds, returns the new user       │
│    b. SELECT username, display_name FROM profiles WHERE id=user.id   │
│    c. profile.display_name is null on a fresh user → redirect to     │
│       /onboarding                                                    │
│       (same query is reused for username derivation downstream —     │
│        zero extra DB round-trip)                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. /onboarding renders OnboardingWizard (3 steps)                    │
│    web/app/onboarding/OnboardingWizard.tsx                           │
│    a. Step 1 — Identity: display_name + username                     │
│       (username availability is rate-limited per H-11)               │
│    b. Step 2 — Journal mode: manual / automated                      │
│    c. Step 3 — Visibility: private / community / public              │
│       Copy: "Prepare your public proof profile" (H-12 polish)        │
│    d. Finish button is path-aware:                                   │
│       - manual → "Go log first trade"                                │
│       - automated → "Go connect account"                             │
│    e. Both paths redirect to /dashboard?activation=1                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 10. /dashboard renders with ActivationPanel                          │
│     web/app/(app)/dashboard/page.tsx + ActivationPanel.tsx           │
│     a. Builds activation summary from profile + trades + accounts +  │
│        ea_tokens (codex-tweak 1 — active tokens via revoked_at NULL) │
│     b. ActivationPanel surfaces the next step based on path:         │
│        - manual: "Log your first trade" → /journal/new               │
│        - automated: "Connect your trading account" → /accounts       │
│     c. Banners gated on activationSummary.nextStep === null (only    │
│        renders after activation completes, codex-tweak 2)            │
│     d. Required-only percent math; optional public_profile step      │
│        never blocks completion (codex-tweak 3)                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Failure modes and where each one is handled

| Failure | Where caught | User-visible behavior |
|---|---|---|
| Email format invalid | Zod (`emailSchema`) at step 3a | "Check your inputs and try again." |
| Password < 12 chars | Zod (`signupPasswordSchema`) at step 3a | "Use at least 12 characters" |
| Honeypot tripped (`website` non-empty) | Step 3b | Silent "Bot detected" |
| Turnstile fails | `verifyTurnstile()` at step 3c | "Couldn't verify you're human. Please try again." |
| `NEXT_PUBLIC_SITE_URL` unset | `trustedAppOrigin()` throws at step 3d | "Signup failed. Try again." (server logs the real reason) |
| Supabase rate limit | `error` from auth.signUp() at step 3f | "Signup failed. Try again." |
| Email already registered | `identities.length === 0` at step 3g | "This email already has an account — log in instead." |
| User opens link 24+ hours later | `exchangeCodeForSession` returns error at step 6c | Currently: still redirects to /dashboard, layout sends to /login. **Could be improved with a `?verify_failed=1` query param + UI hint.** |
| User clicks `next=/admin` etc. in a phished link | M-17 allow-list at step 6b | Falls back to /dashboard, no privilege escalation |
| User refreshes /onboarding mid-flow | `(app)/layout.tsx` re-evaluates on every render | Sees /onboarding again until step 1 is saved; layout then routes them through |

## Things to verify in Supabase Dashboard (operational, not code)

1. **Authentication → URL Configuration → Site URL** —
   should be set to `https://journal.bigmarkt.co` (NOT
   `https://bigmarkt.co`). With the new `emailRedirectTo` override,
   this becomes the fallback only — but setting it correctly is
   defense-in-depth.

2. **Authentication → URL Configuration → Redirect URLs** —
   must explicitly allow-list:
   - `https://journal.bigmarkt.co/auth/callback`
   - (For non-prod testing) any preview URL pattern,
     e.g. `https://journal-git-*-bigmarkt.vercel.app/auth/callback`

   Without this, Supabase rejects the `emailRedirectTo` override and
   silently falls back to Site URL.

3. **Authentication → Email Templates → Confirm Signup** —
   verify the template uses `{{ .ConfirmationURL }}` (not hard-coded
   URLs). The default Supabase template does; if it was customised,
   confirm.

4. **Authentication → Settings → Enable email confirmation** —
   should be `true`. If false, signup creates a session immediately
   and the verification step is skipped entirely (less secure).

5. **Authentication → Settings → Auto-confirm new users** —
   should be `false`. Setting this to true short-circuits the email
   flow and the bug Emeka reported wouldn't even exist — but it
   trades away email verification.

## Open items / follow-ups

- **N-M11 still open:** add an abuse_log gate to signupAction for
  IP-level cap (mirrors N-H7 on reset). Turnstile is already present;
  the missing piece is the server-side per-IP throttle. Reduces
  economic feasibility of using the N-H6-reverted oracle for mass
  enumeration. ~30 min as a small follow-up commit.

- **Verification-failed UX:** if `exchangeCodeForSession` errors
  (expired token, already-consumed token), the callback today
  silently redirects to /dashboard which then bounces to /login.
  Could improve by attaching `?verify_failed=1` and showing a
  banner. Low priority — only affects users who click stale links.

- **`/auth/verified` confirmation page:** the workflow has no
  explicit "you're verified, welcome" page. The journey is
  email → callback → dashboard → onboarding. If product wants a
  "Welcome to BigMarkt" interstitial, that's a new page between
  steps 7 and 8. Out of scope for this fix.

## Shipping this fix

```bash
git add web/app/(auth)/actions.ts docs/signup-workflow.md
git commit -m "fix(auth): verification email now redirects to journal callback

signupAction was calling auth.signUp() without emailRedirectTo, so
Supabase fell back to its Site URL config (currently bigmarkt.co —
marketing site). Verification links landed on the marketing home
page and never created a session.

Fix: pin emailRedirectTo to <journal-origin>/auth/callback?next=/dashboard.
trustedAppOrigin() is the env-locked allow-list already used by
requestResetAction.

After this lands, the flow is:
  email → /auth/callback?code=... → exchangeCodeForSession →
  /dashboard → layout sees empty profile → /onboarding

docs/signup-workflow.md captures the full end-to-end flow including
failure modes and Supabase dashboard config requirements."
```

After push: CI #181 should be green (single TS file change). Then have a user run the flow with a throwaway email and confirm they land in `/onboarding` after clicking the email link, not the marketing home page.
