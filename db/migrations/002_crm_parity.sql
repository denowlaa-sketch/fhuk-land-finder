-- Solar-style CRM parity for FHUK Land Finder (Postgres).
-- Adds pipeline status, numeric score, category, qualification, reasons/unknowns,
-- analysis history, and discovery inbox. Keeps land-specific plot fields.

CREATE TYPE pipeline_status AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST'
);

CREATE TYPE lead_category AS ENUM ('A', 'B', 'C', 'D');

CREATE TYPE qualification_label AS ENUM (
  'EXCELLENT',
  'GOOD',
  'REVIEW',
  'UNSUITABLE',
  'NOT_ANALYSED'
);

CREATE TYPE lead_source AS ENUM (
  'SEARCH',
  'REDDIT',
  'FORUM',
  'CLASSIFIED',
  'AUCTION',
  'FACEBOOK_URL',
  'FIXTURE',
  'MANUAL',
  'AI_DISCOVERY',
  'OTHER'
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status pipeline_status NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0
    CHECK (score >= 0 AND score <= 100),
  ADD COLUMN IF NOT EXISTS category lead_category,
  ADD COLUMN IF NOT EXISTS qualification_label qualification_label
    NOT NULL DEFAULT 'NOT_ANALYSED',
  ADD COLUMN IF NOT EXISTS reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unknowns JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pipeline_version TEXT NOT NULL DEFAULT 'land-v1',
  ADD COLUMN IF NOT EXISTS last_analysed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_kind lead_source NOT NULL DEFAULT 'OTHER';

-- Map legacy contact_status → Solar-style pipeline status.
UPDATE leads SET status = CASE contact_status::text
  WHEN 'Not contacted' THEN 'NEW'::pipeline_status
  WHEN 'Contacted' THEN 'CONTACTED'::pipeline_status
  WHEN 'Interested' THEN 'QUALIFIED'::pipeline_status
  WHEN 'Under offer' THEN 'PROPOSAL'::pipeline_status
  WHEN 'Negotiating' THEN 'NEGOTIATION'::pipeline_status
  WHEN 'Rejected' THEN 'LOST'::pipeline_status
  ELSE 'NEW'::pipeline_status
END
WHERE status = 'NEW' AND contact_status::text <> 'Not contacted';

-- Map Strong / Investigate / Reject onto score + category + qualification.
UPDATE leads SET
  score = CASE ai_assessment::text
    WHEN 'Strong' THEN 85
    WHEN 'Investigate' THEN 55
    WHEN 'Reject' THEN 20
    ELSE score
  END,
  category = CASE ai_assessment::text
    WHEN 'Strong' THEN 'A'::lead_category
    WHEN 'Investigate' THEN 'C'::lead_category
    WHEN 'Reject' THEN 'D'::lead_category
    ELSE category
  END,
  qualification_label = CASE ai_assessment::text
    WHEN 'Strong' THEN 'EXCELLENT'::qualification_label
    WHEN 'Investigate' THEN 'REVIEW'::qualification_label
    WHEN 'Reject' THEN 'UNSUITABLE'::qualification_label
    ELSE qualification_label
  END,
  reasons = CASE
    WHEN ai_rationale IS NOT NULL AND ai_rationale <> '' THEN
      jsonb_build_array(jsonb_build_object('code', 'legacy_rationale', 'detail', ai_rationale))
    ELSE reasons
  END,
  unknowns = CASE
    WHEN landowner_name IS NULL OR contact IS NULL OR asking_price IS NULL THEN
      COALESCE(
        (
          SELECT jsonb_agg(x)
          FROM (
            SELECT 'landowner_name' AS x WHERE landowner_name IS NULL
            UNION ALL SELECT 'contact' WHERE contact IS NULL
            UNION ALL SELECT 'asking_price' WHERE asking_price IS NULL
          ) u
        ),
        '[]'::jsonb
      )
    ELSE unknowns
  END,
  last_analysed_at = COALESCE(last_analysed_at, updated_at),
  source_kind = CASE
    WHEN lower(source) LIKE '%reddit%' THEN 'REDDIT'::lead_source
    WHEN lower(source) LIKE '%forum%' THEN 'FORUM'::lead_source
    WHEN lower(source) LIKE '%gumtree%'
      OR lower(source) LIKE '%preloved%'
      OR lower(source) LIKE '%freeads%'
      OR lower(source) LIKE '%classified%' THEN 'CLASSIFIED'::lead_source
    WHEN lower(source) LIKE '%auction%'
      OR lower(source) LIKE '%plotfinder%'
      OR lower(source) LIKE '%plotbrowser%' THEN 'AUCTION'::lead_source
    WHEN lower(source) LIKE '%facebook%' OR lower(source) LIKE '%fb%' THEN 'FACEBOOK_URL'::lead_source
    WHEN lower(source) LIKE '%fixture%' THEN 'FIXTURE'::lead_source
    WHEN lower(source) LIKE '%google%'
      OR lower(source) LIKE '%bing%'
      OR lower(source) LIKE '%search%'
      OR lower(source) LIKE '%recorded%' THEN 'SEARCH'::lead_source
    WHEN lower(source) LIKE '%manual%' OR lower(source) LIKE '%paste%' THEN 'MANUAL'::lead_source
    ELSE 'OTHER'::lead_source
  END
WHERE score = 0 OR qualification_label = 'NOT_ANALYSED';

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_score_idx ON leads (score DESC);
CREATE INDEX IF NOT EXISTS leads_category_idx ON leads (category);
CREATE INDEX IF NOT EXISTS leads_qualification_idx ON leads (qualification_label);

CREATE TABLE IF NOT EXISTS lead_analyses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score               INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  category            lead_category,
  qualification_label qualification_label NOT NULL,
  ai_assessment       ai_assessment,
  reasons             JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknowns            JSONB NOT NULL DEFAULT '[]'::jsonb,
  pipeline_version    TEXT NOT NULL DEFAULT 'land-v1',
  ran_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_analyses_lead_id_idx
  ON lead_analyses (lead_id, ran_at DESC);

CREATE TABLE IF NOT EXISTS discovery_prospects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  location          TEXT,
  source            TEXT NOT NULL,
  source_kind       lead_source NOT NULL DEFAULT 'OTHER',
  source_url        TEXT,
  external_id       TEXT,
  snippet           TEXT,
  raw_text          TEXT,
  query             TEXT,
  content_hash      TEXT,
  preview_score     INTEGER CHECK (preview_score IS NULL OR (preview_score >= 0 AND preview_score <= 100)),
  preview_assessment ai_assessment,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at       TIMESTAMPTZ,
  imported_lead_id  UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS discovery_prospects_source_url_uidx
  ON discovery_prospects (source_url)
  WHERE source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_prospects_external_id_uidx
  ON discovery_prospects (external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_prospects_content_hash_uidx
  ON discovery_prospects (content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS discovery_prospects_pending_idx
  ON discovery_prospects (created_at DESC)
  WHERE imported_at IS NULL;

CREATE OR REPLACE FUNCTION set_discovery_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discovery_prospects_updated_at ON discovery_prospects;
CREATE TRIGGER discovery_prospects_updated_at
  BEFORE UPDATE ON discovery_prospects
  FOR EACH ROW EXECUTE PROCEDURE set_discovery_updated_at();

-- Keep contact_status roughly aligned when status changes via app (app writes both).
-- Seed analysis rows for existing scored leads.
INSERT INTO lead_analyses (
  lead_id, score, category, qualification_label, ai_assessment,
  reasons, unknowns, pipeline_version, ran_at
)
SELECT
  id, score, category, qualification_label, ai_assessment,
  reasons, unknowns, pipeline_version, COALESCE(last_analysed_at, updated_at)
FROM leads
WHERE NOT EXISTS (
  SELECT 1 FROM lead_analyses la WHERE la.lead_id = leads.id
)
AND (score > 0 OR qualification_label <> 'NOT_ANALYSED');
