# SKILLS LEDGER — Website Agent
# Read at every spawn. Write at close if new domain knowledge gained.
# Max 30 lines. Newest first. Format: [DATE] CATEGORY: lesson (≤120 chars)

[2026-05-02] FACT: Cloudflare Pages already wired to repo (project matchmakersusa-com-preview, account ee673ec9...); staging branches auto-deploy via Git integration — no Actions workflow needed
[2026-05-02] DOCTRINE: github-staging-pr-flow (D# 232) binding — feature → PR-target staging-mvp-** (NOT main) → CI gates → Atlas G1 review on diff → Paul §5 ratify on staging→main merge
[2026-05-02] PATTERN: lhci against staticDistDir via http-server -p 8080 . runs Web Vitals locally without deployed preview — reasonable Day 1 scaffold; converts to fail-closed Day 4
[2026-04-27] DOCTRINE: D1 NO_SCALE_NUMBERS — homepage retires 66,000+ / 7-years scale anchors; posture-anchored institutional facts substitute (D-WEBED-004)
[2026-04-27] DOCTRINE: D2 TEMPORAL_FRAMING — "more than a decade" / "a decade in the making" replaces all "7 years"; Est. 2018 retains for URL provenance
[2026-04-27] DOCTRINE: D3 MOBILE_FIRST_CANONICAL — iPhone 390px is canonical; desktop is enhancement (D-WEBED-005)
[2026-04-27] DOCTRINE: D4 SECTION_PRIMARY_CTA — single primary per scroll-position (not per page); Apple/Blackstone pattern (D-WEBED-006)
[2026-04-27] DOCTRINE: D5 APP_BADGE_BAND — App Store + Google Play badges in dedicated band (Bloomberg/NYT pattern)
[2026-04-27] DOCTRINE: D6 HAIRLINE_AS_ATMOSPHERE — gold/neutral hairlines are primary visual structure (Goldman pattern)
[2026-04-27] DOCTRINE: F-M1 Interpretation B — no-competitors-named rule applies to consumer surfaces only; IR/press carve-out with audience tagging (D-WEBED-003)
[2026-04-27] DOCTRINE: F-V1 — Google Fonts grandfathered for v1+v2 homepage; MM Finals migration deferred to separate workstream
[2026-04-27] DOCTRINE: Reduced-motion = INSTANT (not "shorter") — render at final state, no transition
[2026-04-27] PATTERN: Apple-strip HARD HOLD comment markers — `<!-- APPLE_STRIP_HOLD_BEGIN: lift-trigger=EPD-final-underwriting -->` wrap each apps.apple.com link
[2026-04-27] PATTERN: institutional-fact-strip vs testimonial-wall distinction codified — fact strips OK; testimonial walls + "trusted by N" badges blocked
[2026-04-27] GOTCHA: Single-quoted JS string + apostrophe in user-visible copy = SyntaxError → submit handler never attaches; use double-quote outer or `\'` escape (B-001)
[2026-04-27] GOTCHA: Lighthouse color-contrast gate is WCAG AA 4.5:1 (normal text < 18pt); alpha-blended gold @ 0.55 opacity = 3.26:1 fails (B-002)
[2026-04-27] PATTERN: gh pr merge --squash --delete-branch — preserves linear history; deletes both local + remote branch automatically
[2026-04-27] PATTERN: branch-then-leave for pre-stage skeleton work — uncommitted-on-branch state survives session; commit at PR fire time
[2026-04-27] FACT: handle-stripe-webhook PDF delivery shipped 7a49e25 + deployed; bucket playbook-pdfs has MatchMakers-Playbook.pdf 1.29MB
[2026-04-27] FACT: GAP-C 30-day verify-code window deployed on check-eligibility Edge Function — path-scoped (verify-access still lifetime)
[2026-04-26] FACT: supabase/config.toml + handle-stripe-webhook are website-repo files (Paul correction); old C-3 "iOS-WIP" attribution superseded — ship normally
[2026-04-26] FACT: gold orb retired sitewide via PR #2 + PR #3; js/coach-orb.js + js/coach-storage.js left in tree as dead code (follow-on cleanup pending)
[2026-04-26] FACT: nav unified to single "Coach & Playbook" link sitewide via PR #1 squash; 11 files; /coach/ redirect stub kept
[2026-04-26] FACT: /playbook/content/ is fully-built 1190-line member portal (NOT empty skeleton); chapterization for /access/ rebuild is editorial decision
[2026-04-26] RISK: C-5 — never push without Paul "push it" / "ship it" in current session; authorization does not carry across sessions
[2026-04-26] FACT: Playbook = $250 one-time LIFETIME; AGENT_BIBLE shows $297 STALE; ignore
[2026-04-26] FACT: Stripe DENIED 2026-04-17; EPD migration in underwriting Phase 0; keep Stripe plumbing live until EPD confirmed
[2026-04-26] GOTCHA: GitHub Pages deploys on every push to main — no CI buffer; every push is live to real customers
[2026-04-26] GOTCHA: Site is static HTML on GitHub Pages — do NOT convert to Next.js or any framework
