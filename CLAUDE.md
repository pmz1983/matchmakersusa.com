# MatchMakers Website — CLAUDE.md

This is the **website** repo (`matchmakersusa.com`, static HTML on GitHub Pages).

A separate **iOS repo** at `/Users/paulzigerelli/Desktop/MatchMaker` is owned by a different Claude session. Reading its `docs/*.md` for cross-cutting context is fine. **Never edit, commit, or `git` into that path.**

## Read first (every new session)

1. `.claude/STATE.md` — current sprint, what's in flight, what's next
2. `.claude/CHECKPOINT_LATEST.md` — recovery runbook if the previous session died mid-task
3. `.claude/CONSTITUTION.md` — hard rules (live site, shared Supabase, no experiments)

## Deeper reference

- `.claude/memory/ARCHITECTURE.md` — stack, file layout, integrations, purchase flow
- `.claude/memory/DECISIONS.md` — locked decisions (`D-NNN`)
- `.claude/memory/KNOWN_RISKS.md` — active risks (`R-NNN`)
- `.claude/memory/BUGS.md` — bug log (append-only, `B-NNN`)
- `.claude/memory/SESSIONS.md` — session log (append-only)
- `.claude/skills/preflight/SKILL.md` — pre-commit safety check

## Legacy planning docs (still authoritative for their scope)

These predate the `.claude/` governance and remain live references. Don't delete without user approval.

- `SETUP-PROGRESS.md` — commerce buildout tracker (Stripe section is stale — see `D-001`)
- `CONVERSATION-PLAN.md` — session-by-session roadmap across all tracks
- `SYSTEMS-AUDIT.md` — earlier systems audit (2026-04-15)
- `SESSION-STARTERS.md` — session kickoff prompts

## TL;DR

Static HTML site on GitHub Pages. Sells Playbook ($250) and Dating Coach (Free / Premium $500 / Unlimited $1,000). Backed by Supabase Edge Functions + Stripe. **Stripe is being replaced with Easy Pay Direct** (Stripe denied the dating-services appeal 2026-04-17). Deploy = `git push origin main`. Live customers — no experiments.

Design system: dark navy `#050A10`, gold `#C9A84C`, Cormorant Garamond headers, Outfit body, DM Sans supporting.
