# Secret-Scan Test Fixtures

Fixtures for validating `.claude/skills/preflight/SKILL.md` §1 (secret scan).

**Real credentials are NEVER stored here.** All fixtures are synthetic strings that match the regex pattern structurally but do not correspond to any live credential in any system.

This file is **excluded from the scan itself** via `:(exclude).claude/memory/SECRET_SCAN_TESTS.md` in the preflight pathspec. Fixtures below are also formatted with prefix and payload on separate lines, so even a naive line-based grep won't match them in-place.

## How to re-verify the scan

For each positive fixture:

1. Concatenate prefix + payload into a single string literal
2. `echo 'CONCATENATED_STRING' > /tmp/scan_test.txt`
3. `cp /tmp/scan_test.txt <repo>/scan_test.txt && cd <repo> && git add scan_test.txt`
4. Run the preflight secret scan from `SKILL.md` §1
5. Expected: `STOP`. If `OK`, the regex has regressed — investigate.
6. Clean up: `git reset HEAD scan_test.txt && rm scan_test.txt /tmp/scan_test.txt`

For each negative fixture: edit the named file normally, stage, run scan, expect `OK`.

## Positive tests — must BLOCK (`STOP`)

### P1 — new-format Supabase service_role key

- Pattern: `sb_secret_[A-Za-z0-9_]{24,}`
- Prefix:
    sb_secret_
- Payload (24-char synthetic, mixed case + digits + underscore):
    AaBbCc_DdEe1122_FfGg_HhIi
- Concat the two lines above (no space, no newline) to get the full literal for the throwaway file.
- Expected: STOP

### P2 — Supabase Personal Access Token (PAT)

- Pattern: `sbp_[A-Za-z0-9_]{30,}`
- Prefix:
    sbp_
- Payload (32-char synthetic):
    aabbccddeeff00112233445566778899xy
- Expected: STOP

### P3 — Stripe secret key (live)

- Pattern: `sk_(live|test)_[A-Za-z0-9]{20,}`
- Prefix:
    sk_live_
- Payload (24-char synthetic):
    AaBbCcDdEeFfGgHhIiJjKkLl
- Expected: STOP

### P4 — Stripe secret key (test)

- Pattern: `sk_(live|test)_[A-Za-z0-9]{20,}`
- Prefix:
    sk_test_
- Payload (24-char synthetic):
    MmNnOoPpQqRrSsTtUuVvWwXx
- Expected: STOP

### P5 — Stripe webhook signing secret

- Pattern: `whsec_[A-Za-z0-9]{20,}`
- Prefix:
    whsec_
- Payload (32-char synthetic):
    AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp
- Expected: STOP

### P6 — AWS access key ID

- Pattern: `AKIA[A-Z0-9]{16}`
- Prefix:
    AKIA
- Payload (16-char synthetic, uppercase + digits):
    IOSFODNN7EXAMPLE
- Expected: STOP

### P7 — Long JWT (Supabase anon / legacy service_role / GCP ID)

- Pattern: `eyJ[A-Za-z0-9._-]{40,}`
- Prefix:
    eyJ
- Payload (48-char synthetic, base64url-shaped):
    hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfb28iOi1
- Expected: STOP

## Negative tests — must PASS (`OK`)

### N1 — Prefix-only string in documentation

- Fixture: a line containing just the prefix in backticks, e.g. `` `sk_live_` `` or `` `sb_secret_` ``
- Example line: "Stripe live keys start with `sk_live_`."
- Why it doesn't match: after the prefix is a backtick, which is not in the payload char class; and even if not in backticks, the payload length requirement (20+ / 24+ / 30+) filters out casual mentions.
- Expected: OK

### N2 — Regex literal inside SKILL.md or CHECKPOINT_LATEST.md

- Fixture: the scan regex itself (`sk_(live|test)_[A-Za-z0-9]{20,}` etc.) appearing in docs
- Why it doesn't match: after each prefix the next character is `[` or `(`, which fails the payload char class immediately, and the `{20,}`/`{24,}`/`{30,}` length requirement rules it out anyway.
- Expected: OK

### N3 — Edit to `.claude/skills/preflight/SKILL.md` itself

- Any content edit to the skill file
- Expected: OK (regex literals in the file don't self-match after tightening)

### N4 — Edit to `.claude/CHECKPOINT_LATEST.md`

- Any content edit to the checkpoint file
- Expected: OK (regex literals don't self-match)

## When to re-run

Every time the regex in `SKILL.md` §1 changes:

1. Update the pattern table in this file
2. Run all P-tests — each must still STOP
3. Run all N-tests — each must still OK (edit the file, stage, scan, verify, reset)
4. If any test regresses, **do not commit the regex change.** Fix the regex, re-test.

## Log of regex changes

- **2026-04-17 — initial (retired):** `(eyJ[A-Za-z0-9._-]{20}|sk_live_|sk_test_|sbp_|whsec_|sb_secret_|AKIA)`. Retired same day after false-positive audit — all unquantified prefix-only matches triggered on the scan's own documentation.
- **2026-04-17 — current:** `(eyJ[A-Za-z0-9._-]{40,}|sk_(live|test)_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_]{24,}|whsec_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})`. Length-bounded; distinguishes real-looking keys from literal pattern mentions. `sb_secret_` payload allows `[A-Za-z0-9_]` (NOT hex-only — the live key format is base62+underscore).
