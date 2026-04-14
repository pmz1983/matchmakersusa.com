-- ═══════════════════════════════════════════════════
-- MATCHMAKERS — Analytics Events Table
-- Stores all client-side tracked events
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  page TEXT,
  properties JSONB DEFAULT '{}',
  utm JSONB,
  referrer TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ae_event ON analytics_events(event);
CREATE INDEX idx_ae_visitor ON analytics_events(visitor_id);
CREATE INDEX idx_ae_timestamp ON analytics_events(event_timestamp);
CREATE INDEX idx_ae_page ON analytics_events(page);
CREATE INDEX idx_ae_event_ts ON analytics_events(event, event_timestamp);

-- Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Only service role can read (for dashboards)
-- Public can insert (via edge function, which uses service role)
CREATE POLICY "Service role full access"
  ON analytics_events FOR ALL
  USING (auth.role() = 'service_role');

-- Also add the email_sent column to purchases if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'email_sent'
  ) THEN
    ALTER TABLE purchases ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
