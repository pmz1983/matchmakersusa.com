#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# fire-webcoach-webhook.sh
#
# Fires the webcoach pipeline /reindex webhook on commit to
# /playbook/content/** per Atlas v3 integration trigger directive
# 2026-04-25.
#
# Sub-branch: phase1-playbook-rag-pipeline (Tier 2)
# Triggered by: .github/workflows/webcoach-reindex-trigger.yml
#
# Discipline (C#17 absolute — no plaintext secrets in any form):
# - Secret READ ONLY from $WEBCOACH_REINDEX_WEBHOOK_SECRET env var
# - Secret NEVER echoed, logged, persisted, or expanded into argv
# - openssl -hmac flag consumes the env directly (single invocation)
# - NO `set -x` (would leak env to logs)
# - NO `echo "$WEBCOACH_REINDEX_WEBHOOK_SECRET"` ever
# - Intermediate values not persisted to disk
# - Per webcoach (now-archived) handoff §3-§7 + Atlas v3 integration spec
#
# Required env (set by GitHub Action workflow):
#   WEBCOACH_REINDEX_WEBHOOK_SECRET (vault-injected; redacted in logs)
#   ENDPOINT (Supabase Edge Function URL)
#   GITHUB_SHA, GITHUB_ACTOR, GITHUB_RUN_ID, GITHUB_WORKFLOW
#   GITHUB_EVENT_BEFORE (previous commit SHA; from ${{ github.event.before }})
#
# Idempotency: receiver dedups on commit_sha; safe to re-run.
# Reversibility: git revert workflow + script = clean removal.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# === Required-env validation (fail fast if vault not wired) ===
: "${WEBCOACH_REINDEX_WEBHOOK_SECRET:?must be set by workflow env (vault-injected)}"
: "${ENDPOINT:?must be set by workflow env}"
: "${GITHUB_SHA:?must be set by Actions runner}"
: "${GITHUB_ACTOR:?must be set by Actions runner}"

# === Build payload field values ===
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SHORT_SHA="${GITHUB_SHA:0:7}"

# Commit message — truncated to 200 chars; safe-for-JSON via Python below
COMMIT_MSG=$(git log -1 --pretty=%B "${GITHUB_SHA}" | head -c 200)

# Files changed under playbook/content/** in this commit only
# `|| true` because grep exits 1 on no-match; allowed here
FILES_CHANGED=$(git diff-tree --no-commit-id --name-only -r "${GITHUB_SHA}" \
  | grep '^playbook/content/' || true)

# Diff size in bytes for playbook/content/** changes
# Fall back gracefully if previous commit unavailable (e.g., shallow clone +
# initial commit edge case)
BEFORE_SHA="${GITHUB_EVENT_BEFORE:-}"
if [ -z "${BEFORE_SHA}" ] || [ "${BEFORE_SHA}" = "0000000000000000000000000000000000000000" ]; then
  # No prior commit context (initial commit or unsupported event); compute
  # against parent if reachable
  BEFORE_SHA=$(git rev-parse "${GITHUB_SHA}~1" 2>/dev/null || echo "")
fi

if [ -n "${BEFORE_SHA}" ]; then
  DIFF_SIZE=$(git diff "${BEFORE_SHA}" "${GITHUB_SHA}" -- 'playbook/content/**' \
    2>/dev/null | wc -c | tr -d ' ' || echo "0")
else
  DIFF_SIZE="0"
fi

# === Build canonical body ===
# Python handles JSON escaping correctly + sorted keys + 2-space indent per
# webcoach §3.1 canonical-byte-form contract. All values passed via env to
# avoid shell-interpolation pitfalls with special characters in commit msgs.
BODY=$(env \
  COMMIT_MSG="${COMMIT_MSG}" \
  FILES_CHANGED="${FILES_CHANGED}" \
  DIFF_SIZE="${DIFF_SIZE}" \
  TIMESTAMP="${TIMESTAMP}" \
  SHORT_SHA="${SHORT_SHA}" \
  python3 <<'PYEOF'
import json
import os

files = [
  line.strip()
  for line in os.environ.get("FILES_CHANGED", "").splitlines()
  if line.strip()
]

payload = {
  "event":                "playbook_content_commit",
  "trigger_type":         "T1",
  "repository":           "matchmakersusa-com",
  "commit_sha":           os.environ["GITHUB_SHA"],
  "commit_short_sha":     os.environ["SHORT_SHA"],
  "commit_timestamp_utc": os.environ["TIMESTAMP"],
  "commit_author":        os.environ.get("GITHUB_ACTOR", "unknown"),
  "commit_message":       os.environ.get("COMMIT_MSG", ""),
  "branch":               "main",
  "files_changed":        files,
  "diff_size_bytes":      int(os.environ.get("DIFF_SIZE", "0") or "0"),
  "github_run_id":        os.environ.get("GITHUB_RUN_ID", ""),
  "github_workflow":      os.environ.get("GITHUB_WORKFLOW", "")
}

# sorted keys + 2-space indent = canonical byte form for HMAC
print(json.dumps(payload, sort_keys=True, indent=2))
PYEOF
)

# === Compute HMAC SHA-256 over (timestamp + "." + canonical body) ===
# - openssl -hmac consumes the secret env directly via the flag
# - SIGNED_PAYLOAD is built in-memory; not written to disk
# - Output piped to awk to extract just the hex digest
SIGNED_PAYLOAD="${TIMESTAMP}.${BODY}"
SIGNATURE=$(printf "%s" "${SIGNED_PAYLOAD}" \
  | openssl dgst -sha256 -hmac "${WEBCOACH_REINDEX_WEBHOOK_SECRET}" \
  | awk '{print $2}')

# === Fire POST ===
# --fail        → non-zero exit on 4xx/5xx (workflow failure → alert)
# --silent      → suppress curl progress output
# --show-error  → preserve error display when --silent + failure combine
# --max-time    → hard ceiling 30s for the request
curl --fail --silent --show-error --max-time 30 \
  -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=${SIGNATURE}" \
  -H "X-Webhook-Timestamp: ${TIMESTAMP}" \
  -H "X-Webhook-Secret-Id: wh_q1_2026-04-25" \
  -H "User-Agent: matchmakersusa-website-agent/${SHORT_SHA}" \
  --data "${BODY}"

# Success: workflow exits 0; receiver acknowledged within 30s
# Failure: --fail returns non-zero; workflow status = failed; GitHub
# Actions failure notification fires to repo notifications
