# UK + Estonia Readiness & Acquisition Effectiveness Audit

**Scope:** All four surfaces — web/ (journal.bigmarkt.co), sites/marketing/ (bigmarkt.co), sites/fts/ (fts.bigmarkt.co), sites/club/ (club.bigmarkt.co)  
**Method:** Read-only. All quotes are real strings from the codebase with file:line references.  
**Date:** 9 June 2026

---

## Surface 1 — web/ (journal.bigmarkt.co)

### Current framing
The signed-out landing page positions the product as a broker-verified trading journal with a public leaderboard. Hero headline (L63–67):
```
"The Verified Trading Journal."
"Verified by your broker."
```
Features block explains auto-capture, public leaderboard, and signals (L108–115):
> "Subscribe to leaders. Signals are delivered to your journal as data. Copy execution is on the roadmap."

Footer risk notice (L188–191):
> "Trading involves substantial risk of loss. Past performance is not indicative of future results. BigMarkt is a journaling and transparency tool, not a financial advisor."

### Primary CTA
"Start free" → `/signup`  
Secondary: "See the leaderboard" → `/leaderboard`

### DONE ✓
- Privacy Policy page exists (`web/app/privacy/page.tsx`) — UK GDPR + EU GDPR, ICO + Estonian DPA (aki.ee) both named
- Privacy Policy footer link present (`web/app/page.tsx` L182)
- "By submitting, you agree to our Privacy Policy." on signup form (`web/app/(auth)/signup/page.tsx`)
- Signals correctly described as data, not commands (feature card, L115)
- Risk disclaimer in footer
- "not a financial advisor" explicit

### ADD
1. **Footer tagline fix.** `web/app/page.tsx` L174: `"Trade. Verify. Earn."` — the word "Earn" is intact on this surface (M1 only touched `sites/marketing` and `sites/club`). Should be changed to `"Trade. Journal. Verify."` to match marketing and prevent the implication of guaranteed financial return.
2. **Estonia/UK geographic signal.** No jurisdiction-specific copy anywhere on the signed-out surface. Given the Estonia registration, even a one-liner in the footer ("Serving traders in the UK and EEA") would help with local trust and SEO.
3. **Trading Constitution.** Not referenced anywhere on any surface. If this is the lead product-differentiator innovation, a section or link on the landing page (even a "coming soon" teaser) would anchor the brand before competitors copy the idea.

### REMOVE / WALL OFF
1. **"Execution" StatusPill in `/subscriptions`.** `web/app/(app)/subscriptions/page.tsx` L68–71: subscriptions with `mode === "execution"` display a pill labelled `"Execution"`. If copy-execution is not yet live (marketing correctly gates it as "on the roadmap"), surfacing this label to logged-in users risks implying it is functional. Wall off behind a feature flag or relabel as `"Copy (coming soon)"` until execution is live.

### REBALANCE
- The leaderboard preview on the landing page falls back gracefully when empty (L127: `"Leaderboard fills as traders connect their brokers. Be one of the first."`). Good. However the stat bar (L85–89: "X verified traders · X auto-captured trades · X public leaders") shows `"—"` for all metrics when the DB returns null. On a low-traffic day this looks like a dead product. Consider a minimum floor copy ("Growing daily — be an early member") in the zero-state.

### Compliance flags
- ✅ GDPR privacy page with ICO + aki.ee supervisory authorities
- ✅ "journaling and transparency tool, not a financial advisor" explicit
- ✅ "Past performance is not indicative of future results"
- ⚠️ "Execution" mode label in subscriptions — see WALL OFF above
- ⚠️ "Trade. Verify. Earn." footer tagline — see ADD above

---

## Surface 2 — sites/marketing/ (bigmarkt.co)

### Current framing
Protocol/vision site. Hero on homepage is identical to the journal landing: "The Verified Trading Journal. Verified by your broker." Three-layer positioning: Journal (live), Copy-signal (building), $BMT (planned). Footer tagline updated to `"Trade. Journal. Verify."` (M1 ✓).

### Primary CTA
"Start Free" → `https://journal.bigmarkt.co/signup`  
Secondary: "See the Leaderboard" → `https://journal.bigmarkt.co/leaderboard`

### DONE ✓
- Footer tagline: "Trade. Journal. Verify." (`sites/marketing/app/_components/Footer.tsx`)
- $BMT use-cases section has "Future phase · Planned" badge and disclaimer (`sites/marketing/app/token/page.tsx` L63–67)
- Privacy Policy page and footer link (`sites/marketing/app/privacy/page.tsx`, `_components/Footer.tsx`)
- Protocol page explicit: "A signal is information, not a command" and "Legal architecture" section (not a portfolio manager)
- Layer statuses: 01/02 "Phase 1 · Live", 03 "Phase 2 · Building", 04/05 "Phase 3/4 · Planned" — correct

### ADD
1. **Trading Constitution page or section.** Not present anywhere. If this is a genuine product innovation, marketing is the right surface to introduce it — even a stub with a waitlist/notify email.
2. **Estonian establishment signal.** No reference to Estonian registration or EEA presence on the marketing site. A brief "registered within the EEA" or "EU data residency" note (accurate per the privacy policy) would strengthen trust for the Baltic/European acquisition target.

### REMOVE / WALL OFF
1. **Ecosystem flywheel present-tense.** `sites/marketing/app/ecosystem/page.tsx`: `"Verified leaders earn reputation, stake $BMT, publish signals."` — $BMT staking is future-phase only. "publish signals" is building-phase. The present-tense "earn reputation, stake $BMT" is inconsistent with the "Future phase · Planned" badge on the token page. Recommend: `"Verified leaders build reputation, and — in a future phase — stake $BMT to publish signals."` or add a "(planned)" qualifier inline.

### REBALANCE
- StatBar (`sites/marketing/app/_components/StatBar.tsx`) correctly shows `"—"` on API failure. Same zero-state concern as web/ — no copy alternative. Low priority on the marketing site where logged-out visitors may not notice, but worth a fallback string.

### Compliance flags
- ✅ GDPR privacy page — ICO + aki.ee both named
- ✅ "Future phase · Planned" on all $BMT use-cases
- ✅ Protocol page positions signal as information, not financial advice
- ⚠️ Ecosystem flywheel: "stake $BMT, publish signals" in present tense despite both being future/building phases — see REMOVE above

---

## Surface 3 — sites/fts/ (fts.bigmarkt.co)

### Current framing
Free Trading School / Academy. Lead messaging (`sites/fts/app/page.tsx` L29):
> "Learn to trade properly. No hype. No expensive courses. A growing community of traders building real skills."

Positions as education, not advice. Three pathways: FTS Channel (Telegram), Boot Camp (13-module, pioneer cohort forming), War Room (graduates only). Cross-link to journal.bigmarkt.co with "Your journal is your reputation." framing.

### Primary CTA
"Apply for Boot Camp" → `#apply` (same-page anchor form)  
Secondary: "Join FTS Channel" → `https://t.me/fts_bigmarkt` (external, target="_blank")

### DONE ✓
- Privacy Policy page and footer link (`sites/fts/app/privacy/page.tsx`, `_components/Footer.tsx`)
- "By submitting, you agree to our Privacy Policy." on ApplicationForm (`sites/fts/app/_components/ApplicationForm.tsx`)
- "No hype. No expensive courses." — explicit non-advisory framing
- War Room access-gated to graduates ("Graduates only")
- Boot Camp labelled "Pioneer Cohort Now Forming" — honest about pre-launch status

### ADD
1. **Module 9 (Trade Journaling) → journal link.** The bootcamp/page.tsx lists all 13 modules including `"09 — Trade Journaling: What to record, how to review, key metrics, journal template."` There is already a cross-link section ("Learn here. Prove it there.") but it only appears after the full pathway grid. A direct anchor from Module 9 in the module list to journal.bigmarkt.co/signup would convert warm learners at the exact moment of intent.
2. **Estonian/UK student framing.** FTS has no geographical targeting. If the Tallinn launch is a focus, even a "Now welcoming students in the UK and Estonia" notice in the pioneer cohort banner would differentiate the cohort geographically.

### REMOVE / WALL OFF
- No fabricated claims found. War Room requirements list is honest (self-asserted). No issues to wall off.

### REBALANCE
- Boot Camp uses Zoom/Google Meet (L60 in bootcamp/page.tsx) and a Telegram group (`t.me/ftsbootcamp`). The public FTS Channel is `t.me/fts_bigmarkt`. Telegram links are correct and segregated — no confusion between surfaces.
- "No hype" is a strong promise. Modules 11–12 include "Going Live" and "Smart Money Concepts" — genuine advanced content. The framing is accurate.

### Compliance flags
- ✅ GDPR privacy page — ICO + aki.ee named
- ✅ Privacy acknowledgement on application form
- ✅ Education positioned as skill-building, not financial advice
- ✅ "No hype. No expensive courses." — honest framing
- No MiCA or MiFID exposure on this surface (education only, no token or signal features)

---

## Surface 4 — sites/club/ (club.bigmarkt.co)

### Current framing
Campus financial literacy club. Hero (`sites/club/app/page.tsx` L61–66):
```
"BigMarkt Club. Learn money. For real this time."
"Financial literacy. Trading skills. Industry mentorship."
"Free to join. Built for students who want more than a degree."
```
"Real capital opportunities." and "Capital programme access" from Leader tier removed in M1 ✓. Mentor cards removed and replaced with coming-soon ✓.

### Primary CTA
"Join Free" → `/join`  
Secondary: "Explore the Club" → `/about`

### DONE ✓
- Mentor cards removed; page now reads: "Mentor profiles will be announced as the programme launches." (`sites/club/app/mentorship/page.tsx`)
- "Capital programme access" removed from Leader tier join page and homepage (`sites/club/app/join/page.tsx`, `sites/club/app/page.tsx`)
- Privacy Policy page and footer link
- "By submitting, you agree to our Privacy Policy." on ApplicationForm (`sites/club/app/_components/ApplicationForm.tsx` L120–126)

### ADD
1. **Trading Constitution.** Same gap as marketing — not referenced anywhere on club. As a student club, this could be presented as the first thing members produce/sign, making it a tangible deliverable that justifies joining.
2. **Credibility for tiers.** Leader tier now says "Merit Only — By Selection". There is no explanation of what merit means or who selects. Adding one sentence ("Chapter leads are selected by BigMarkt based on community contribution and track record") would prevent the perception of an arbitrary gate.

### REMOVE / WALL OFF
1. **Testimonials.** `sites/club/app/page.tsx` L76–80 contains three student testimonials:
   - `"BigMarkt Club changed how I think about money completely." — Amara O., University of Lagos`
   - `"The Trading Track gave me skills my finance degree never covered." — Kwame A., KNUST Ghana`
   - `"I joined knowing nothing. Now I actually understand markets." — Fatima S., University of Nairobi`

   The club is in pioneer/pre-launch phase. These testimonials are structurally identical to the mentor cards that were removed in M1 (fabricated social proof from unverifiable people). If these are real testimonials from real students, retain them with consent confirmed. If they are fabricated, remove them and replace with an honest "Pioneer cohort forming — be one of the first" placeholder. **This is a credibility risk equivalent to the mentor cards.**

### REBALANCE
- Hero subtext still says "Industry mentorship" despite the mentorship page being replaced with a coming-soon notice. If mentorship is not yet live, "Industry mentorship" in the hero should be softened to "Industry mentorship (coming soon)" or removed from the bulleted tagline until the programme launches.

### Compliance flags
- ✅ GDPR privacy page — ICO + aki.ee named
- ✅ Privacy acknowledgement on application form
- ✅ Capital programme and mentor claims removed (M1)
- ⚠️ Testimonials from unverifiable students — credibility risk, possible fabrication — see REMOVE above
- ⚠️ "Industry mentorship" in hero while mentorship page is a coming-soon — see REBALANCE above

---

## Cross-Surface Consistency

| Item | web/ | marketing/ | fts/ | club/ |
|------|------|------------|------|-------|
| Footer tagline | ❌ "Trade. Verify. **Earn.**" | ✅ "Trade. Journal. Verify." | N/A | ✅ (M1 done) |
| Privacy page | ✅ | ✅ | ✅ | ✅ |
| Privacy footer link | ✅ | ✅ | ✅ | ✅ |
| Form privacy consent | ✅ signup | N/A (no form) | ✅ apply | ✅ apply |
| ICO + aki.ee named | ✅ | ✅ | ✅ | ✅ |
| EU data residency (Ireland) | ✅ | ✅ | ✅ | ✅ |
| SCC transfer safeguard mention | ✅ | ✅ | ✅ | ✅ |
| "not a financial advisor" | ✅ explicit | ✅ via protocol page | ✅ implicit ("no hype") | ✅ implicit (education) |
| $BMT "Future phase" badge | N/A | ✅ | N/A | N/A |
| Signals = data, not commands | ✅ explicit | ✅ protocol page | N/A | N/A |
| Trading Constitution | ❌ absent | ❌ absent | ❌ absent | ❌ absent |
| Telegram segregated | ✅ bigmarkt_hq | ✅ bigmarkt_hq | ✅ fts_bigmarkt / ftsbootcamp | N/A |

**Critical inconsistency:** `web/app/page.tsx` L174 still has `"Trade. Verify. Earn."` — the only surface where the old tagline survives. All other surfaces say "Journal. Verify." This is the single most visible cross-surface copy inconsistency.

---

## Roadmap Delta

Items the audit confirms are **not yet visible** on any public surface:

| Missing item | Where it belongs | Priority |
|---|---|---|
| Footer tagline fix on web/ | `web/app/page.tsx` L174 | **High — immediate** |
| "Execution" label wall-off in subscriptions | `web/app/(app)/subscriptions/page.tsx` L68-71 | **High** |
| Ecosystem flywheel tense fix | `sites/marketing/app/ecosystem/page.tsx` | **High** |
| Club testimonial audit/removal | `sites/club/app/page.tsx` L76-80 | **High** |
| "Industry mentorship" hero softening | `sites/club/app/page.tsx` subheadline | **Medium** |
| Trading Constitution (any surface) | marketing/ lead; club/ as member deliverable | **Medium** |
| Estonian/UK geographic signal | web/ footer; marketing/ footer; fts/ pioneer banner | **Medium** |
| Module 9 → journal.bigmarkt.co anchor | `sites/fts/app/bootcamp/page.tsx` module list | **Low** |
| Zero-state stat bar fallback copy | web/, marketing/ | **Low** |
| Leader tier selection criteria | `sites/club/app/join/page.tsx` | **Low** |

Items confirmed **shipped and correct**:

- Privacy Policy pages on all four surfaces ✓  
- Footer tagline on marketing/ and club/ ✓  
- Mentor card removal on club/ ✓  
- Capital programme removal on club/ ✓  
- $BMT use-cases "Future phase · Planned" badge and disclaimer ✓  
- Privacy consent on all three forms (web/signup, fts/apply, club/apply) ✓  
- ICO + Estonian DPA (aki.ee) in all four privacy pages ✓  
- Processors described by category only, no brand names ✓  
- support@bigmarkt.co throughout (de.bigmarkt@gmail.com fully replaced) ✓  
- SCC transfer safeguard mentioned in all four privacy pages ✓  
- Database within EU (Ireland) disclosed ✓  
- Signals = "data, not a command" — web/ feature card + marketing/ protocol page ✓  
- Telegram channels correctly segregated (main / FTS / bootcamp) ✓  
