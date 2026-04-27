-- =============================================================================
-- Phase 2 — decrement_messages_remaining(user_email) RPC widening
-- =============================================================================
-- Trigger: webcoach §2.2 cross-lane flag (Atlas relay 2026-04-27) — production
--   RPC's product filter likely matches `dating_coach_premium` only; needs to
--   widen to include `dating_coach_and_playbook` for fast-path parity with the
--   PR #9 product key rename + the coach-proxy fallback at lines 446-470 which
--   already filters by both products.
-- ───────────────────────────────────────────────────────────────────────────
-- Source-of-truth for canonical semantics: coach-proxy/index.ts:446-470
--   (the fallback path executed when this RPC is unavailable). Mirrors:
--     • email + product IN [dating_coach_and_playbook, dating_coach_premium]
--     • status = 'completed'
--     • most recent purchase by created_at DESC LIMIT 1
--     • atomic decrement WHERE messages_remaining > 0
--     • return number of rows updated (1 = success, 0 = no decrement)
-- ───────────────────────────────────────────────────────────────────────────
-- §5.B compliance:
--   • `purchases` table is NON-algo-protected. Standard §4 process applies.
--   • UPDATE writes only `messages_remaining` column; bounded WHERE clause.
--   • SECURITY DEFINER + search_path lock per Issue 8 §c standing recommendation.
--   • DROP + CREATE pattern handles return-type-change resilience (CREATE OR
--     REPLACE alone fails if the existing function has a different return type).
--   • ZERO §5.B-blocked operations.
-- ───────────────────────────────────────────────────────────────────────────
-- Idempotency: DROP IF EXISTS + CREATE FUNCTION pattern is re-run safe.
-- Atomicity: function-level (per-call); migration itself is single-statement.
-- =============================================================================

-- §1 — Drop existing function (return-type-change resilient)
DROP FUNCTION IF EXISTS public.decrement_messages_remaining(text);

-- §2 — Create canonical widened version
CREATE FUNCTION public.decrement_messages_remaining(user_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_purchase_id uuid;
  v_updated_count integer;
BEGIN
  -- Find the most recent quota-bearing purchase for this email.
  -- Quota-bearing tiers per PR #9 + coach-proxy:
  --   • dating_coach_and_playbook (3-msg allowance bundled with $250 Playbook)
  --   • dating_coach_premium      (25-msg allowance with $500 Coach Premium)
  -- (dating_coach_unlimited has unlimited messages; not handled here.)
  SELECT id INTO v_purchase_id
  FROM public.purchases
  WHERE email = user_email
    AND product IN ('dating_coach_and_playbook', 'dating_coach_premium')
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;

  -- No quota-bearing purchase found
  IF v_purchase_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Atomically decrement; predicate `messages_remaining > 0` handles
  -- concurrent-decrement race + null/zero guard in one shot.
  UPDATE public.purchases
     SET messages_remaining = messages_remaining - 1
   WHERE id = v_purchase_id
     AND messages_remaining IS NOT NULL
     AND messages_remaining > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
  -- Returns 1 on successful decrement; 0 when no decrement happened
  -- (no messages left OR no quota-bearing purchase). Caller (coach-proxy
  -- line 473) treats `> 0` as success.
END;
$$;

-- §3 — GRANT execution to service_role (Edge Function calls via service-role client)
GRANT EXECUTE ON FUNCTION public.decrement_messages_remaining(text) TO service_role;

-- §4 — Verification queries (run post-deploy; read-only)
SELECT proname, pg_get_function_arguments(oid) AS args,
       array_to_string(proconfig, ', ') AS config,
       CASE prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'decrement_messages_remaining';
-- EXPECTED: 1 row; security=DEFINER; config includes "search_path=public, pg_catalog";
-- args = "user_email text".

-- §5 — Smoke-test (staging only; do NOT run on production with arbitrary
-- emails). Replace <test_email> with a fixture-seeded test user.
--
-- SELECT public.decrement_messages_remaining('<test_email>');
-- -- EXPECTED: returns 1 if test user has messages_remaining > 0; 0 otherwise.

-- =============================================================================
-- §6 — Rollback path
-- =============================================================================
-- If post-deploy telemetry surfaces an issue, rollback to the prior body via
-- a new migration. Backend stages a follow-up SQL with the prior body if
-- Atlas surfaces it via diagnostic. Default rollback (if prior body unknown):
-- restore to the dating_coach_premium-only filter:
--
-- DROP FUNCTION IF EXISTS public.decrement_messages_remaining(text);
-- CREATE FUNCTION public.decrement_messages_remaining(user_email text) ...
--   (same body but WHERE product = 'dating_coach_premium' instead of IN clause)
--
-- The function is read-trivial and re-deployable; no data restoration needed.
-- =============================================================================
