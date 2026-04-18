# Known Risks — matchmakersusa.com

Active risks. Mark `mitigated` / `closed` when resolved; keep the entry for audit trail.

## Format

Each risk has a stable ID:

- `R-NNN` — operational / technical risks
- `R-LEAK-NNN` — credential-leak incidents (kept forever, even after mitigation)

Template fields: **Severity** (CRITICAL / HIGH / MEDIUM / LOW), **Discovered**, **Impact**, **Mitigation plan**, **Status** (open / mitigated / closed).

---

## R-LEAK-001 — Plaintext service_role key in local git-ignored doc

- **Severity:** was HIGH (as local exposure) → now MITIGATED
- **Discovered:** 2026-04-17 (during governance bootstrap)
- **Location:** `SETUP-PROGRESS.md` lines 5–6. File is git-ignored and has never been tracked.
- **Impact as discovered:** Service_role key sitting in plaintext on local disk. Exposure vectors: screen capture during pair programming / demos, accidental backup sync, accidental `git add --force`, local device compromise.
- **Verified scope:**
  - `git log --all --oneline -- SETUP-PROGRESS.md` → **0 commits**
  - `git ls-files --error-unmatch SETUP-PROGRESS.md` → not tracked
  - `raw.githubusercontent.com/pmz1983/matchmakersusa.com/main/SETUP-PROGRESS.md` → **404** (independently verified by Paul)
  - First 20 commits of repo scanned — no trace of the file or the key
  - **Conclusion:** never publicly leaked. Local-only exposure.
- **Mitigation applied (2026-04-17):**
  1. Paul rotated the service_role key via Supabase Dashboard → Settings → API
  2. Redacted `SETUP-PROGRESS.md` lines 5–6 on disk (no commit because file isn't tracked)
  3. Codified `D-007` and `C-4` — no plaintext secrets in any repo file
  4. Added secret-scan step to `.claude/skills/preflight/SKILL.md`
- **Status:** MITIGATED
- **Optional future hardening:** `git filter-repo` is **not needed** (nothing in history to scrub). Consider a pre-commit git hook that runs the `preflight` secret-scan automatically.

## R-002 — Stripe wind-down timeline unknown

- **Severity:** HIGH
- **Discovered:** 2026-04-17
- **Impact:** If Stripe cuts processing before Easy Pay Direct integration is live, website revenue pauses. iOS subscription revenue is unaffected.
- **Mitigation plan:**
  1. Email Stripe support for exact processing-cutoff date and policy for existing subscriptions
  2. Book discovery calls with Easy Pay Direct AND PaymentCloud in week 1
  3. Integrate EPD hosted form in parallel (week 2–3) — keep Stripe live during transition
  4. Default planning assumption: 60-day runway from 2026-04-17
- **Refs:** `D-001`, iOS `docs/STRIPE_MIGRATION_GAMEPLAN.md`
- **Status:** open

## R-003 — No client-side idempotency on processor calls

- **Severity:** MEDIUM
- **Discovered:** 2026-04-17
- **Impact:** Rapid double-clicks on checkout could create duplicate charges. Stripe's own idempotency covers most of this today; the replacement processor (EPD) may not.
- **Mitigation plan:** Generate idempotency key client-side before redirect, echo to server webhook, dedupe on the server.
- **Status:** open — becomes more urgent during EPD migration.

## R-004 — Google Sheets revenue ledger has no backup

- **Severity:** LOW-MEDIUM
- **Discovered:** 2026-04-17
- **Impact:** Single point of failure. Sheet corruption or accidental delete = lost revenue history.
- **Mitigation plan:** Either (a) add Apps Script trigger duplicating rows to a second sheet, or (b) dual-write to a Supabase `revenue_ledger` table on each webhook fire.
- **Status:** open

## R-005 — PostHog not installed; attribution is partial

- **Severity:** LOW
- **Discovered:** 2026-04-17
- **Impact:** GA4 captures traffic but not product events cleanly. No UTM persistence across sessions. Can't cleanly measure which channels drive Playbook vs Coach purchases.
- **Mitigation plan:** Apply patch from `MatchMaker/docs/WEBSITE_ANALYTICS_PATCH.md`. Needs real `phc_...` key.
- **Refs:** `D-005`
- **Status:** open
