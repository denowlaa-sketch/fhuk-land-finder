-- Facebook Instant Form intake + consent-gated call attempts (PECR-safe).
-- Adds FACEBOOK source (distinct from FACEBOOK_URL paste), consent fields,
-- call_attempts audit, and owner_notifications for QUALIFIED alerts.

-- lead_source: Instant Form vs URL paste stay distinct.
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'FACEBOOK';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS consent_to_call BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facebook_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS form_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS leads_facebook_lead_id_uidx
  ON leads (facebook_lead_id)
  WHERE facebook_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_call_queue_idx
  ON leads (source_kind, status, consent_to_call)
  WHERE consent_to_call = TRUE;

CREATE TYPE call_attempt_mode AS ENUM ('SANDBOX', 'LIVE');

CREATE TYPE call_attempt_status AS ENUM (
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED'
);

CREATE TYPE call_outcome AS ENUM (
  'QUALIFIED',
  'UNQUALIFIED',
  'NO_ANSWER',
  'CALLBACK'
);

CREATE TABLE IF NOT EXISTS call_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  mode              call_attempt_mode NOT NULL DEFAULT 'SANDBOX',
  status            call_attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  outcome           call_outcome,
  summary           TEXT,
  answers           JSONB NOT NULL DEFAULT '{}'::jsonb,
  twilio_call_sid   TEXT,
  twilio_status     TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_attempts_lead_id_idx
  ON call_attempts (lead_id, started_at DESC);

CREATE INDEX IF NOT EXISTS call_attempts_status_idx
  ON call_attempts (status, started_at DESC);

CREATE OR REPLACE FUNCTION set_call_attempts_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS call_attempts_updated_at ON call_attempts;
CREATE TRIGGER call_attempts_updated_at
  BEFORE UPDATE ON call_attempts
  FOR EACH ROW EXECUTE PROCEDURE set_call_attempts_updated_at();

CREATE TYPE owner_notification_status AS ENUM (
  'sent',
  'sandbox',
  'failed'
);

CREATE TABLE IF NOT EXISTS owner_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_attempt_id   UUID REFERENCES call_attempts(id) ON DELETE SET NULL,
  status            owner_notification_status NOT NULL,
  channel           TEXT NOT NULL DEFAULT 'email',
  to_address        TEXT,
  subject           TEXT,
  detail            TEXT,
  provider_response JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS owner_notifications_lead_id_idx
  ON owner_notifications (lead_id, created_at DESC);
