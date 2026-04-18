# Decisions — matchmakersusa.com

Locked business + technical decisions. Append-only. Newest at bottom. One entry per decision.

---

## D-001 — Migrate off Stripe to Easy Pay Direct

- **Date:** 2026-04-17
- **Context:** Stripe denied Paul's appeal to keep dating services on their platform.
- **Decision:** Primary replacement = Easy Pay Direct (specializes in dating). Fallback = PaymentCloud.
- **Scope:** Website payment processor only. iOS StoreKit is unaffected (Apple handles iOS subscriptions).
- **Timeline:** 4-week aggressive, 8-week safe. Depends on Stripe's wind-down date (not yet communicated).
- **Sources:** `MatchMaker/docs/PAYMENT_PROCESSOR_ANALYSIS.md`, `MatchMaker/docs/STRIPE_MIGRATION_GAMEPLAN.md`
- **Implication:** Do not build new Stripe features. Do not rip out existing Stripe plumbing until EPD is live.

## D-002 — Pricing

- **Date:** 2026-04-15 (commit `7124130`)
- **Playbook:** $250 one-time (digital)
- **Dating Coach tiers:** Free, Premium $500, Unlimited $1,000
- **Rationale:** Playbook is the anchor up-sell; Coach tiers support both volume and margin.

## D-003 — Playbook-first gating for Dating Coach

- **Date:** 2026-04-15
- **Decision:** Dating Coach purchase is gated behind Playbook ownership. `check-eligibility` Edge Function enforces this server-side.
- **Rationale:** Playbook teaches the framework. Coach presumes that context. Gating reduces cold-start refund risk.

## D-004 — GA4 installed site-wide

- **Date:** 2026-04-17 (commit `f8a2951`)
- **Tag:** `G-W3EJNGC0JR`
- **Scope:** All pages.

## D-005 — PostHog = product analytics, runs alongside GA4

- **Date:** 2026-04-17
- **Decision:** PostHog for product analytics (funnels, session replay, event tracking). GA4 stays for traffic + attribution. Both active in parallel; not a replacement.
- **Status:** Patch ready in `MatchMaker/docs/WEBSITE_ANALYTICS_PATCH.md`. Awaits real `phc_...` key + injection.

## D-006 — North Star metric = Playbook + Coach purchases per week

- **Date:** 2026-04-17
- **Source:** `MatchMaker/docs/DECISIONS_2026-04-17.md`
- **Leading indicator:** users who clicked a premium in-app offer.

## D-007 — No plaintext secrets in any repo file

- **Date:** 2026-04-17
- **Context:** `SETUP-PROGRESS.md` contained a plaintext Supabase service_role key on disk. Never committed (file was git-ignored from the start) and never publicly leaked — verified via `git log --all` returning 0 commits touching the file, `raw.githubusercontent.com/...` 404, and scan of first 20 commits. Still a real local-exposure risk (screen capture, backup sync, accidental `git add --force`). Rotated defensively. See `R-LEAK-001`.
- **Rule:** no file in this repo — governance or otherwise — stores credentials in plaintext. Reference credentials by env-var name, pointing to the source (Supabase Dashboard / 1Password / Stripe Dashboard / Supabase function env). See `CONSTITUTION.md` `C-4`.

## D-008 — Legacy planning docs stay as-is

- **Date:** 2026-04-17
- **Context:** During governance bootstrap, four root-level planning docs (`SETUP-PROGRESS.md`, `CONVERSATION-PLAN.md`, `SYSTEMS-AUDIT.md`, `SESSION-STARTERS.md`) overlap with `.claude/STATE.md` scope.
- **Decision:** Keep them in place. `STATE.md` is the live doc; legacy docs remain authoritative for their narrower scopes. No archive, no supersede, no deletion.
- **Rationale:** Lowest-disruption option. User currently opens `SETUP-PROGRESS.md` by habit.
