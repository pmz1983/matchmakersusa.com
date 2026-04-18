# State — matchmakersusa.com

**Last updated:** 2026-04-17 (governance bootstrap)
**Git:** branch `main`, in sync with `origin/main`. Uncommitted `supabase/` changes owned by iOS session (leave alone per `C-3`).
**Last deployed commit:** `f8a2951` — GA4 added + homepage buy-box centering fix

---

## What's in flight

_(empty — bootstrap complete, waiting on user to pick next work item)_

## Recently resolved

- **2026-04-17** — Supabase service_role key rotated defensively; `SETUP-PROGRESS.md` plaintext redacted on disk. Verified the key was never committed or publicly leaked (file was git-ignored from the start). See `R-LEAK-001`.

---

## What's next (priority order)

### 🔴 P0 — Stripe → Easy Pay Direct migration (revenue continuity)

- Stripe denied appeal 2026-04-17. Wind-down timeline unknown.
- **Next actions:**
  1. Email Stripe for exact cutoff date
  2. Book discovery calls with Easy Pay Direct + PaymentCloud
  3. Integrate EPD hosted form on website (~1-2 days) or Accept.js (~3-5 days)
  4. Rewrite webhook handler for EPD event shape
- **Refs:** `D-001`, `R-002`, iOS `docs/PAYMENT_PROCESSOR_ANALYSIS.md`, `docs/STRIPE_MIGRATION_GAMEPLAN.md`

### 🟡 P1 — Install PostHog

- Patch is paste-ready in iOS `docs/WEBSITE_ANALYTICS_PATCH.md`.
- Needs: real `phc_...` key from PostHog account, then inject into `index.html` + subpage templates.
- GA4 already live (`G-W3EJNGC0JR`) — PostHog runs alongside, not replacing.
- **Why this matters:** North Star metric is Playbook + Coach purchases/week. PostHog is the attribution + session-replay layer.
- **Refs:** `D-005`, `R-005`

### 🟡 P1 — Premium Playbook PDF delivery

- `playbook-pdf/MatchMakers-Playbook.pdf` exists (1.3 MB, built 2026-04-16, currently untracked).
- **Decisions pending:**
  - Store in git, or upload to Supabase Storage with signed URLs (7-day expiry)?
  - If Storage: update `handle-stripe-webhook` to email signed URL post-purchase.
- **Refs:** `SETUP-PROGRESS.md` "REMAINING" section

### 🟢 P2 — Analytics hardening

- UTM capture on every page load (session-persist to `sessionStorage`)
- `cta_clicked` / `begin_checkout` / `purchase` events on key CTAs (Playbook, Coach, Assessment)
- Client-side idempotency key on processor redirects (see `R-003`)

### 🟢 P2 — Revenue ledger backup

- Google Sheets revenue ledger has no backup. Add Apps Script trigger to duplicate rows to a second sheet, or dual-write to a Supabase `revenue_ledger` table on each webhook fire.
- **Refs:** `R-004`

---

## Reference pointers

- `SETUP-PROGRESS.md` — credentials + completed commerce setup (Stripe section stale)
- `CONVERSATION-PLAN.md` — long-form roadmap across Tracks A-E
- `SYSTEMS-AUDIT.md` — systems audit (2026-04-15)
- `SESSION-STARTERS.md` — session kickoff prompts
- iOS repo strategic docs:
  - `MatchMaker/docs/PAYMENT_PROCESSOR_ANALYSIS.md`
  - `MatchMaker/docs/STRIPE_MIGRATION_GAMEPLAN.md`
  - `MatchMaker/docs/WEBSITE_ANALYTICS_PATCH.md`
  - `MatchMaker/docs/DECISIONS_2026-04-17.md`
