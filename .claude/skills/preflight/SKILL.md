---
name: preflight
description: Pre-commit safety check for matchmakersusa.com. Run before any `git commit`. Blocks common mistakes on a live customer site.
---

# Preflight — Pre-commit safety check

Run these checks before `git commit`. If any fail, stop and surface to the user.

## 1. Secret scan (required)

    git diff --staged -- . ':(exclude).claude/memory/SECRET_SCAN_TESTS.md' | grep -iE '(eyJ[A-Za-z0-9._-]{40,}|sk_(live|test)_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_]{24,}|whsec_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})' && echo STOP || echo OK

- Prints `STOP` if any likely secret is in the staged diff; `OK` otherwise.
- **If `STOP`:** do not commit. `git reset HEAD <file>`, redact, re-stage, re-run.
- `SECRET_SCAN_TESTS.md` is deliberately excluded from the scan — it contains synthetic fixtures used to verify this check. **Never put real credentials there.** All fixtures must match the pattern structurally while being non-credentials.
- Pattern coverage (length-bounded to avoid false positives on regex literals in docs):
  - `eyJ[A-Za-z0-9._-]{40,}` — JWTs (Supabase anon, legacy service_role, GCP ID tokens)
  - `sk_(live|test)_[A-Za-z0-9]{20,}` — Stripe secret keys
  - `sbp_[A-Za-z0-9_]{30,}` — Supabase Personal Access Tokens
  - `sb_secret_[A-Za-z0-9_]{24,}` — Supabase new-format service_role keys (**not hex** — payload is base62 + underscore)
  - `whsec_[A-Za-z0-9]{20,}` — Stripe and Supabase webhook signing secrets
  - `AKIA[A-Z0-9]{16}` — AWS access key IDs

Any regex change must re-pass the fixture tests in `.claude/memory/SECRET_SCAN_TESTS.md`. Extend the pattern list (and the fixture file) as new providers surface (e.g. `phc_` PostHog keys, EPD processor keys once known).

## 2. Out-of-scope path check

    git diff --cached --name-only

- **Fail** if any path resolves under `/Users/paulzigerelli/Desktop/MatchMaker` → iOS repo, off-limits (`C-2`).
- **Warn** if any path starts with `supabase/functions/` or `supabase/migrations/` → shared with iOS session (`C-3`). Confirm with user before proceeding.

## 3. Broken reference check (HTML / CSS / JS changes)

For each staged HTML/CSS/JS file, grep for asset references that no longer exist in the repo:

- `<script src=…>`, `<link href=…>`, `<img src=…>`, `background-image: url(…)`
- Especially relative paths broken by moved / renamed files.

## 4. Destructive-change check

**Fail** if the diff deletes any load-bearing file:

- `CNAME` — custom domain binding
- `.nojekyll` — GitHub Pages Jekyll bypass
- `robots.txt`, `sitemap.xml`
- `index.html`, `404.html`

**Warn** if the diff touches `supabase/config.toml` — iOS session likely owns it.

## 5. Commit message lint

- First line ≤ 72 characters
- Imperative mood ("Add X", not "Added X")
- Include `Co-Authored-By:` trailer when Claude authored the change

## 6. Confirm deploy intent

- `git commit` is local-only → safe to proceed.
- If the user is about to `git push origin main`, remind them: **every push is a production deploy to matchmakersusa.com** (`C-5`). Require explicit "push it" / "ship it" confirmation before pushing.

## When to run

- Automatically before any `git commit` you propose.
- Manually when the user says "preflight" or "check before commit."
