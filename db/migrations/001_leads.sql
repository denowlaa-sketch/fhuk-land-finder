-- Phase 0: leads table for FHUK Land Finder
-- Lead refs use FHUK-NNNN format (e.g. FHUK-0001).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE opportunity_type AS ENUM (
  'backland',
  'garden_plot',
  'brownfield',
  'infill',
  'agricultural',
  'other'
);

CREATE TYPE planning_status AS ENUM (
  'none',
  'pre_app',
  'outline',
  'full',
  'expired',
  'unknown'
);

CREATE TYPE ownership_confidence AS ENUM (
  'confirmed',
  'likely',
  'possible',
  'unknown'
);

CREATE TYPE ai_assessment AS ENUM (
  'Strong',
  'Investigate',
  'Reject'
);

CREATE TYPE contact_status AS ENUM (
  'Not contacted',
  'Contacted',
  'Interested',
  'Negotiating',
  'Under offer',
  'Rejected'
);

CREATE TABLE IF NOT EXISTS leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               TEXT NOT NULL UNIQUE,           -- FHUK-NNNN
  location          TEXT NOT NULL,
  opportunity_type  opportunity_type NOT NULL DEFAULT 'other',
  land_size         TEXT,                           -- free text e.g. "0.2 acres"
  asking_price      NUMERIC(14, 2),
  planning_status   planning_status NOT NULL DEFAULT 'unknown',
  source            TEXT NOT NULL,                  -- e.g. stub_search, reddit, gumtree
  original_post_url TEXT,
  landowner_name    TEXT,
  contact           TEXT,                           -- phone / email as published
  ownership_confidence ownership_confidence NOT NULL DEFAULT 'unknown',
  seller_motivation TEXT,
  ai_assessment     ai_assessment NOT NULL DEFAULT 'Investigate',
  ai_rationale      TEXT,
  date_discovered   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contact_status    contact_status NOT NULL DEFAULT 'Not contacted',
  raw_excerpt       TEXT,
  content_hash      TEXT,                           -- dedupe key
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leads_ref_format CHECK (ref ~ '^FHUK-[0-9]{4,}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_original_post_url_uidx
  ON leads (original_post_url)
  WHERE original_post_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_content_hash_uidx
  ON leads (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_ai_assessment_idx ON leads (ai_assessment);
CREATE INDEX IF NOT EXISTS leads_contact_status_idx ON leads (contact_status);
CREATE INDEX IF NOT EXISTS leads_date_discovered_idx ON leads (date_discovered DESC);
CREATE INDEX IF NOT EXISTS leads_location_idx ON leads (location);

CREATE SEQUENCE IF NOT EXISTS leads_ref_seq START 1;

CREATE OR REPLACE FUNCTION next_lead_ref() RETURNS TEXT AS $$
  SELECT 'FHUK-' || LPAD(nextval('leads_ref_seq')::TEXT, 4, '0');
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION set_leads_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE PROCEDURE set_leads_updated_at();
