# Sessions — matchmakersusa.com

Append-only log. Newest at bottom. One entry per session.

## Format

Each entry has:

- Date + short title
- **Goal** — what the user asked for
- **Touched** — files changed
- **Outcome** — shipped / committed / blocked on X
- **Follow-ups** — items added to `STATE.md`, `KNOWN_RISKS.md`, etc.

---

## 2026-04-17 — Governance bootstrap + retroactive leak hygiene

- **Goal:** Initialize `.claude/` structure + `CLAUDE.md` after previous website session died on a 400 error.
- **Discovered during bootstrap:** `SETUP-PROGRESS.md` contained a plaintext Supabase service_role key. Initial framing assumed the key was committed to public git. Investigation showed the file has **0 commits** touching it across all branches (git-ignored from day one); GitHub blob URL 404s; first 20 commits scanned clean. Risk was local-exposure only, not a public leak.
- **Actions:**
  - Paul rotated the service_role key via Supabase Dashboard (2026-04-17)
  - Redacted `SETUP-PROGRESS.md` lines 5–6 on disk (no commit — file isn't tracked)
  - Logged as `R-LEAK-001` with status MITIGATED
  - Recorded decision `D-007` — no plaintext secrets in any repo file
  - Added secret-scan step to `.claude/skills/preflight/SKILL.md`
- **Touched (committed in this session):**
  - `CLAUDE.md` (repo root)
  - `.claude/CONSTITUTION.md`
  - `.claude/STATE.md`
  - `.claude/CHECKPOINT_LATEST.md`
  - `.claude/memory/ARCHITECTURE.md`
  - `.claude/memory/BUGS.md`
  - `.claude/memory/DECISIONS.md`
  - `.claude/memory/KNOWN_RISKS.md`
  - `.claude/memory/SESSIONS.md` (this file)
  - `.claude/skills/preflight/SKILL.md`
- **Not touched:**
  - Existing `.claude/launch.json` and `.claude/serve.sh` (VS Code dev scripts)
  - Uncommitted `supabase/config.toml` + `supabase/functions/handle-stripe-webhook/index.ts` (owned by iOS session per `C-3`)
  - Legacy root planning docs (`SETUP-PROGRESS.md`, `CONVERSATION-PLAN.md`, `SYSTEMS-AUDIT.md`, `SESSION-STARTERS.md`) — kept as-is per `D-008`
  - `CONVERSATION-PLAN.md` and `playbook-pdf/` (untracked, out of scope)
- **Commit:** `governance: initialize .claude/ structure + CLAUDE.md` (local only, not pushed per `C-5`).
- **Follow-ups open:**
  - `R-002` — Stripe wind-down timeline (HIGH)
  - `R-003` — Client-side idempotency (MEDIUM)
  - `R-004` — Ledger backup (LOW-MEDIUM)
  - `R-005` — PostHog install (LOW)
- **Next session:** Paul to pick a work item from `STATE.md` priority list.
