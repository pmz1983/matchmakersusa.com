# Checkpoint — Latest Recovery Runbook

Use this when a session crashes mid-task or you're picking up cold.

## 1. Orient

```bash
cd /Users/paulzigerelli/Desktop/matchmakersusa.com
git log --oneline -10
git status
git branch --show-current
```

## 2. Read in this order

1. `CLAUDE.md` (repo root) — project overview + pointers
2. `.claude/STATE.md` — what's in flight, what's next
3. `.claude/CONSTITUTION.md` — hard rules
4. `.claude/memory/SESSIONS.md` — tail last 2-3 entries

## 3. Check for orphan state

- **Uncommitted changes to `supabase/`** → iOS session owns that surface. Leave alone (`C-3`).
- **Uncommitted changes elsewhere** → previous website session died mid-work. Ask the user before proceeding.
- **Untracked files** → check against `.gitignore`. Ask before committing anything new.

## 4. Before any edit

- Path is NOT under `/Users/paulzigerelli/Desktop/MatchMaker` (`C-2`)
- Path is NOT under `supabase/functions/` or `supabase/migrations/` (`C-3`)
- `Read` before `Edit` or `Write` (`C-7`)

## 5. Before any commit

- Run preflight (`.claude/skills/preflight/SKILL.md`)
- Secret scan: run the full recipe in `.claude/skills/preflight/SKILL.md` §1 (tightened regex with length bounds; excludes `SECRET_SCAN_TESTS.md`). Quick form: `git diff --staged -- . ':(exclude).claude/memory/SECRET_SCAN_TESTS.md' | grep -iE '(eyJ[A-Za-z0-9._-]{40,}|sk_(live|test)_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_]{24,}|whsec_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})' && echo STOP || echo OK`. Any `STOP` → investigate before commit.
- Use `Co-Authored-By:` trailer

## 6. Before any push

- **Explicit user approval required. Always.** (`C-5`)
- `git push origin main` = production deploy to matchmakersusa.com
- Never `--force`. Never rewrite `main` history.

## 7. Before ending the session

- Append entry to `.claude/memory/SESSIONS.md`
- Update `.claude/STATE.md` "What's in flight"
- New bug → `BUGS.md` (`B-NNN`)
- New locked decision → `DECISIONS.md` (`D-NNN`)
- New risk → `KNOWN_RISKS.md` (`R-NNN`)

## Common gotchas

- **`.nojekyll` must stay** — GitHub Pages will otherwise try to Jekyll-process the site and break asset paths.
- **`CNAME` file must stay** — it's how the custom domain resolves.
- **Homepage is `index.html` (~72KB). CSS is `css/style.css` (~66KB).** Both too big for a full `Read` in one call. Use `Grep` + targeted `Read` with `offset`/`limit`.
- **The iOS session's "app-side" credentials and the website's credentials overlap** (same Supabase project, same Stripe account). A change here can affect both.
