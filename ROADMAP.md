# BigMarkt — Product Roadmap (Pre-Launch, UK/EU-ready)

_Last updated: 16 July 2026. Supersedes the original 26-session plan where they conflict._

## Positioning
Pre-launch product is a regulatory-clean verified trading journal + analytics, supported by
the FTS education community. The lead is broker-verified, tamper-evident trade records. Copy
execution and the $BMT token are future, post-authorisation phases — not built or marketed as
live. AI claims stay honest (rule-based detection live; LLM advisory in development). No
pricing until payments ship. Acquisition-first.

## Done — pre-launch cleanup track (M0–M6)
- M0 — UK/EU readiness audit (UK_EE_AUDIT.md)
- M1 — removed live misrepresentation (fabricated mentors/testimonials, unsubstantiated
  claims, "Earn" tagline; $BMT labelled "planned")
- M2 — GDPR privacy policy on all four surfaces (neutral framing, processors by category,
  support@bigmarkt.co); no cookie banner required (no analytics in use)
- M3 — follow is journal-only; auto-execution gated in UI + server (infra retained, dormant)
- M4 — honest "coming soon" state on the Signals tab
- M5 — single dominant CTA per surface (marketing/fts signup-first, club own-join)
- M6 — this roadmap

## Shipped since the cleanup track

- Trading Constitution with rule declaration, adherence checks, and journal integration.
- Verified social layer: following feed, open-position visibility, reactions, discovery, and public trade theses.
- In-app guide covering the shipped journal workflows.
- Pro entitlement wiring and read-only MetaApi cloud capture, including on-demand deploy, sync, and undeploy.
- Referral visibility, cloud account metrics, and broker-verified leaderboard inclusion with a post-join scoring boundary.

## Next — pre-launch work

1. Payments and self-serve Pro upgrades; admin-comped Pro exists, but billing does not.
2. Restore frequent cloud-sync orchestration when the production Vercel plan supports it; on Hobby, cloud sync remains user-triggered and the daily cron performs cleanup.
3. Leader content access and eventual payment gating.
4. Admin-configurable scoring gates and final launch-readiness verification.
5. Onboard founding leaders and expand evidence-backed marketing content.

## Reclassified — POST-AUTHORISATION (do not build or market pre-launch)
- Copy execution protocol (orig. Sessions 13–18) — FCA / MiFID II regulated. UI gated; infra dormant.
- $BMT token (orig. Sessions 19–22) — MiCA / FCA regulated. Labelled "planned"; build post-authorisation only.
- Trade execution and regulated crypto features remain deferred. Read-only Bybit history ingestion exists in code but does not place trades or move funds.

## Deferred / tracked
- Marketing stats block → wire to live data once user numbers are meaningful.
- Cookie consent banner → required the moment any analytics is added (none today).
- support@bigmarkt.co outbound "send-as".
- Registered entity to replace "BigMarkt" trading name; solicitor review of privacy + FCA boundary before visa submission.
- Optional hero tamper-evidence line.
