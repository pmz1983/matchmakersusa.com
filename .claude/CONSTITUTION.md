# Constitution — matchmakersusa.com

Hard rules. Violate only with explicit user approval.

## C-1. This is a live customer site

- Production is served off `main` on GitHub Pages. **Every push is a deploy.**
- No experimental code paths. No `console.log` spam. No in-progress features shipped "behind a flag" — there is no flag system.
- If a change could break checkout, playbook unlock, or access-code redemption, test it end-to-end before pushing.

## C-2. iOS repo is off-limits

- `/Users/paulzigerelli/Desktop/MatchMaker` belongs to a separate Claude session.
- Read-only access for cross-cutting docs (`MatchMaker/docs/*.md`) is fine.
- **Never edit, commit, or `git` into that path.**

## C-3. Shared Supabase surface

- `supabase/functions/` contains Edge Functions shared with the iOS session.
- **Do NOT modify `supabase/functions/` or `supabase/migrations/`** unless the user explicitly asks AND confirms the iOS session is idle.
- As of 2026-04-17, uncommitted changes exist in `supabase/config.toml` and `supabase/functions/handle-stripe-webhook/index.ts` — those belong to the iOS session. Leave them alone.

## C-4. No secrets in new files

- Never commit API keys, service-role keys, webhook secrets, OAuth tokens, or Resend/Stripe/Supabase secrets to any new file.
- `SETUP-PROGRESS.md` previously contained a plaintext Supabase service_role key on disk. Never committed (file was git-ignored from the start) and never publicly leaked — but plaintext-on-disk is still real exposure (screen capture, backup sync, accidental `git add --force`). Key rotated 2026-04-17 and doc redacted. See `R-LEAK-001`. Do not repeat the pattern.
- When referencing a secret, name the env var (e.g. `STRIPE_WEBHOOK_SECRET`) and point to its source (Supabase dashboard, 1Password, Stripe dashboard).

## C-5. No deploys without approval

- `git push origin main` deploys to production. **Never push without the user saying "push it" / "ship it" / similar.**
- Local `git commit` for work-in-progress is fine, but flag every commit in your reply so the user sees it.
- Never `git push --force`. Never rewrite history on `main`.

## C-6. Stripe is being replaced

- Stripe denied the dating-services appeal on 2026-04-17. Migration target: Easy Pay Direct (primary), PaymentCloud (fallback). See `memory/DECISIONS.md` `D-001`.
- Don't build new Stripe features.
- Don't add new Stripe Payment Links.
- Don't rip out existing Stripe plumbing either — it has to run until the new processor is live.

## C-7. Read before write

- Don't `Write` over an existing file without `Read`ing it first.
- Prefer `Edit` over `Write` for existing files — smaller, reviewable diffs.

## C-8. Every session logs itself

- Before ending a session, append a dated entry to `.claude/memory/SESSIONS.md` describing what was touched and why.
- If you discovered a bug → log to `BUGS.md` with a new `B-NNN` ID.
- If you locked a decision → log to `DECISIONS.md` with a new `D-NNN` ID.
- If you spotted a risk → log to `KNOWN_RISKS.md` with a new `R-NNN` ID.
- Update `STATE.md` "What's in flight" if work is partial.
