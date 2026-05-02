<!--
  matchmakersusa.com PR template.
  PRs target the active staging branch (NOT main) per github-staging-pr-flow.
  main → live deploy fires only after Paul §5 ratify of staging→main merge.
-->

## Scope

<!-- Which sprint day / cohort / dispatch does this PR satisfy? -->

## Changes

<!-- Bullet list of what changed; one bullet per file/area is plenty. -->

## CI gate status

<!-- Tick each row as gates pass (or note `n/a` for non-frontend PRs). -->

- [ ] Secret scan (preflight regex)
- [ ] Load-bearing-file deletion guard
- [ ] HTML validation
- [ ] Web Vitals (Lighthouse ≥90 perf/a11y/best/seo)
- [ ] WCAG 2.1 AA (pa11y-ci)
- [ ] Link check (lychee)
- [ ] Cartier voice 8-check (when Web Ed skill lands)
- [ ] 15-criterion §9 binary AI-output gate (when applicable)
- [ ] 28-trope catalog scan (when applicable)

## Atlas G1 review

<!-- Atlas reviews diff per github-staging-pr-flow Rule 4. Cite verdict here. -->

- §5.B-protected surfaces UNTOUCHED (rank_count / level / score / photo_rankings) — verify with file diff
- C#1 release-branch protection preserved
- C#14 no Apple/Play console submission code paths
- C#17 no plaintext credentials
- Founder anonymity preserved on user-facing copy
- iOS-silence preserved (no iOS-app deep-link copy on Cartier surfaces)
- Apple-good-standing preserved (zero ASC touch; v3.3 LIVE 72942dc unaffected)

Verdict: <!-- pending | approve | amend | reject -->

## Cross-lane handoffs

<!-- e.g., Backend RPC contract consumed; Design Figma absorbed; webcoach copy applied. -->

## Preview URL

<!-- Cloudflare Pages preview URL for this branch / commit. -->

## Notes for reviewers

<!-- Risk areas; manual-test recipes; blockers; questions for Paul. -->

---

<!--
  Per github-staging-pr-flow:
    - Rule 2: this PR targets staging-mvp-**, NEVER main.
    - Rule 5: staging branch auto-deploys to preview URL on merge.
    - Rule 6: staging→main merge requires Paul §5 ratify phrase
      (`ratify staging → main merge — <commit-sha-or-PR-number-list> — deploy live`).
    - Rule 8: rollback path is `git revert <sha>` on main, not history rewrite.
-->
