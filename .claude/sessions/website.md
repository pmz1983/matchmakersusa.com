# Website session — heartbeat

Cross-session contract file for Atlas (master-source-of-truth session) to poll state of this website-repo session.

---

## Status

- **Last activity:** 2026-04-18
- **Branch:** `main`
- **Head commit (website work):** _pending — will be stamped post-commit_
- **Ahead of `origin/main`:** yes (governance bootstrap + og v2, not yet pushed)
- **In flight:** nothing — awaiting push approval (per `CONSTITUTION` `C-5`)

## Most recent shipped change

**OG image v2 — hero-title-only composition + cache-bust rename**

- Regenerated social-share image to show only MatchMakers wordmark + URL + "Take Dating to the Next Level" headline
- Removed tagline and stats row (66K+ / 7 / $0 / 100%) — illegible at feed thumbnails, and `66K+` member count conflicts with the "no member-count in store-adjacent assets" brand rule
- Renamed `img/og-image.png` → `img/og-image-v2.png` (1200×630, 306 KB) to force cache-bust across iMessage / WhatsApp / Facebook / LinkedIn / Slack / Twitter
- Added `og:image:secure_url` and `twitter:image` tags (net-new on all 6 main pages)
- Updated `og:image` / `og:image:secure_url` / `twitter:image` on: `index.html`, `coach/`, `playbook/`, `assessment/`, `guide/`, `vip/`
- Template + render script checked in for reproducibility: `img/og-template.html`, `img/render-og.mjs` (reuses Puppeteer from `playbook-pdf/node_modules/`)

## Post-push checklist (waiting)

Once `git push origin main` is approved + executed:

- [ ] Visit https://developers.facebook.com/tools/debug/ — paste each of the 6 URLs, click **Scrape Again**:
  - `https://matchmakersusa.com/`
  - `https://matchmakersusa.com/coach/`
  - `https://matchmakersusa.com/playbook/`
  - `https://matchmakersusa.com/assessment/`
  - `https://matchmakersusa.com/guide/`
  - `https://matchmakersusa.com/vip/`
- [ ] Spot-check iMessage preview by sending the URL to a test number
- [ ] Update this heartbeat's `Head commit` field with the push confirmation
- [ ] Update `.claude/memory/SESSIONS.md` with the post-push state

## Governance pointers

For a new Claude session reading this file cold:
- `CLAUDE.md` (repo root) — project overview, full pointer index
- `.claude/STATE.md` — current sprint + priority list
- `.claude/CONSTITUTION.md` — hard rules (esp. `C-2` iOS off-limits, `C-3` shared Supabase, `C-5` no push w/o approval)
- `.claude/memory/SESSIONS.md` — append-only session log

## Change log

- **2026-04-18** — og-image v2 committed locally (hero-title-only, cache-bust rename). Awaiting push approval.
- **2026-04-17** — governance bootstrap committed (`df8f31a`). `.claude/` structure + `CLAUDE.md` + preflight skill + `R-LEAK-001` mitigated.
