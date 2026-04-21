-- ═══════════════════════════════════════════════════
-- MATCHMAKERS — VIP Applications Table
-- Replaces the fragile mailto:-based submission path with
-- server-side capture. Written by Edge Function
-- submit-vip-application; read by future admin role.
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vip_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Applicant identity (NOT NULL — required by form)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Application content
  intent TEXT NOT NULL,                  -- select-list value
  seeking TEXT NOT NULL,                 -- long-form free text
  why TEXT NOT NULL,                     -- long-form free text
  coach_completion TEXT NOT NULL,        -- select-list value

  -- Submission metadata (best-effort capture; optional)
  source_ip INET,
  user_agent TEXT,

  -- Workflow state (managed by advisor / admin tooling)
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'contacted', 'accepted', 'declined')),
  advisor_assigned TEXT,
  processed_at TIMESTAMPTZ
);

-- Indexes for advisor workflow + analytics queries
CREATE INDEX IF NOT EXISTS idx_vip_apps_created_at  ON vip_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vip_apps_status      ON vip_applications(status);
CREATE INDEX IF NOT EXISTS idx_vip_apps_email_lower ON vip_applications(LOWER(email));

-- Row Level Security
-- Edge Function uses the service role key (bypasses RLS); the policy
-- below is a deny-by-default posture for any future client / anon
-- key access. When admin auth lands (Workstream 5), add an admin
-- read policy here.
ALTER TABLE vip_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on vip_applications"
  ON vip_applications FOR ALL
  USING (auth.role() = 'service_role');
