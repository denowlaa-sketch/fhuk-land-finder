-- Ad Leads channels: Instagram (Meta Lead Ads) + TikTok Lead Generation.
-- Extends PECR consent-gated call queue beyond FACEBOOK Instant Form.
-- Meta FB + IG share the same leadgen webhook; source_kind distinguishes channel.
-- TikTok uses tiktok_lead_id for dedupe (parallel to facebook_lead_id).

ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'TIKTOK';

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tiktok_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_channel TEXT;

-- ad_channel: 'facebook' | 'instagram' | 'tiktok' (display / filter; mirrors source_kind)
COMMENT ON COLUMN leads.ad_channel IS
  'Paid ad lead channel: facebook | instagram | tiktok';

CREATE UNIQUE INDEX IF NOT EXISTS leads_tiktok_lead_id_uidx
  ON leads (tiktok_lead_id)
  WHERE tiktok_lead_id IS NOT NULL;

-- Broaden call-queue index to all consented ad-lead sources.
DROP INDEX IF EXISTS leads_call_queue_idx;
CREATE INDEX leads_call_queue_idx
  ON leads (source_kind, status, consent_to_call)
  WHERE consent_to_call = TRUE
    AND source_kind IN (
      'FACEBOOK'::lead_source,
      'INSTAGRAM'::lead_source,
      'TIKTOK'::lead_source
    );

CREATE INDEX IF NOT EXISTS leads_ad_channel_idx
  ON leads (ad_channel)
  WHERE ad_channel IS NOT NULL;
