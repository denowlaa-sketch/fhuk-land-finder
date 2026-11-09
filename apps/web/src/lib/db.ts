import { Pool, type QueryResultRow } from "pg";
import { analyseLead, PIPELINE_VERSION } from "./scoring";
import type {
  AiAssessment,
  ContactStatus,
  DiscoveryProspect,
  Lead,
  LeadAnalysis,
  LeadCategory,
  LeadSourceKind,
  PipelineStatus,
  QualificationLabel,
  ScoreReason,
} from "./types";
import { CONTACT_TO_STATUS, STATUS_TO_CONTACT } from "./types";

let pool: Pool | null = null;

/** Hosted Postgres (Neon / Supabase / Vercel) needs TLS; local Docker usually does not. */
function poolSsl(
  connectionString: string,
): boolean | { rejectUnauthorized: boolean } | undefined {
  const lower = connectionString.toLowerCase();
  if (
    lower.includes("sslmode=disable") ||
    lower.includes("localhost") ||
    lower.includes("127.0.0.1")
  ) {
    return undefined;
  }
  if (
    lower.includes("sslmode=require") ||
    lower.includes("sslmode=verify") ||
    lower.includes("neon.tech") ||
    lower.includes("supabase.co") ||
    lower.includes("postgres.vercel-storage.com") ||
    process.env.PGSSL === "require" ||
    process.env.VERCEL === "1"
  ) {
    return {
      rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === "true",
    };
  }
  return undefined;
}

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
      ssl: poolSsl(url),
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapLead(row: QueryResultRow): Lead {
  const contactStatus = (row.contact_status ??
    "Not contacted") as ContactStatus;
  const status = (row.status ??
    CONTACT_TO_STATUS[contactStatus] ??
    "NEW") as PipelineStatus;

  return {
    id: row.id,
    ref: row.ref,
    location: row.location,
    opportunity_type: row.opportunity_type,
    land_size: row.land_size,
    asking_price:
      row.asking_price === null || row.asking_price === undefined
        ? null
        : Number(row.asking_price),
    planning_status: row.planning_status,
    source: row.source,
    source_kind: (row.source_kind ?? "OTHER") as LeadSourceKind,
    original_post_url: row.original_post_url,
    landowner_name: row.landowner_name,
    contact: row.contact,
    ownership_confidence: row.ownership_confidence,
    seller_motivation: row.seller_motivation,
    ai_assessment: row.ai_assessment,
    ai_rationale: row.ai_rationale,
    date_discovered: new Date(row.date_discovered).toISOString(),
    status,
    contact_status: contactStatus,
    score: Number(row.score ?? 0),
    category: (row.category ?? null) as LeadCategory | null,
    qualification_label: (row.qualification_label ??
      "NOT_ANALYSED") as QualificationLabel,
    reasons: parseJsonArray<ScoreReason>(row.reasons),
    unknowns: parseJsonArray<string>(row.unknowns).map(String),
    pipeline_version: row.pipeline_version ?? PIPELINE_VERSION,
    last_analysed_at: row.last_analysed_at
      ? new Date(row.last_analysed_at).toISOString()
      : null,
    raw_excerpt: row.raw_excerpt,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    consent_to_call: Boolean(row.consent_to_call ?? false),
    consent_at: row.consent_at
      ? new Date(row.consent_at).toISOString()
      : null,
    facebook_lead_id: row.facebook_lead_id ?? null,
    tiktok_lead_id: row.tiktok_lead_id ?? null,
    ad_channel: (row.ad_channel as Lead["ad_channel"]) ?? null,
    form_payload:
      typeof row.form_payload === "object" && row.form_payload !== null
        ? (row.form_payload as Record<string, unknown>)
        : {},
  };
}

function mapAnalysis(row: QueryResultRow): LeadAnalysis {
  return {
    id: row.id,
    lead_id: row.lead_id,
    score: Number(row.score),
    category: (row.category ?? null) as LeadCategory | null,
    qualification_label: row.qualification_label,
    ai_assessment: (row.ai_assessment ?? null) as AiAssessment | null,
    reasons: parseJsonArray<ScoreReason>(row.reasons),
    unknowns: parseJsonArray<string>(row.unknowns).map(String),
    pipeline_version: row.pipeline_version ?? PIPELINE_VERSION,
    ran_at: new Date(row.ran_at).toISOString(),
  };
}

function mapProspect(row: QueryResultRow): DiscoveryProspect {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    source: row.source,
    source_kind: (row.source_kind ?? "OTHER") as LeadSourceKind,
    source_url: row.source_url,
    external_id: row.external_id,
    snippet: row.snippet,
    raw_text: row.raw_text,
    query: row.query,
    content_hash: row.content_hash,
    preview_score:
      row.preview_score === null || row.preview_score === undefined
        ? null
        : Number(row.preview_score),
    preview_assessment: (row.preview_assessment ?? null) as AiAssessment | null,
    payload:
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {},
    imported_at: row.imported_at
      ? new Date(row.imported_at).toISOString()
      : null,
    imported_lead_id: row.imported_lead_id,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export interface LeadFilters {
  status?: PipelineStatus | "";
  category?: LeadCategory | "";
  qualification?: QualificationLabel | "";
  search?: string;
  minScore?: number;
}

function buildLeadWhere(filters: LeadFilters = {}): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.status) {
    clauses.push(`status = $${i++}::pipeline_status`);
    params.push(filters.status);
  }
  if (filters.category) {
    clauses.push(`category = $${i++}::lead_category`);
    params.push(filters.category);
  }
  if (filters.qualification) {
    clauses.push(`qualification_label = $${i++}::qualification_label`);
    params.push(filters.qualification);
  }
  if (filters.minScore != null && !Number.isNaN(filters.minScore)) {
    clauses.push(`score >= $${i++}`);
    params.push(filters.minScore);
  }
  if (filters.search?.trim()) {
    clauses.push(
      `(location ILIKE $${i} OR ref ILIKE $${i} OR source ILIKE $${i} OR COALESCE(landowner_name,'') ILIKE $${i})`,
    );
    params.push(`%${filters.search.trim()}%`);
    i += 1;
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const db = getPool();
  if (!db) return [];
  const { sql, params } = buildLeadWhere(filters);
  const { rows } = await db.query(
    `SELECT * FROM leads ${sql} ORDER BY date_discovered DESC, ref ASC`,
    params,
  );
  return rows.map(mapLead);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [id]);
  return rows[0] ? mapLead(rows[0]) : null;
}

export async function getLeadByRef(ref: string): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(`SELECT * FROM leads WHERE ref = $1`, [ref]);
  return rows[0] ? mapLead(rows[0]) : null;
}

export async function listLeadAnalyses(leadId: string): Promise<LeadAnalysis[]> {
  const db = getPool();
  if (!db) return [];
  try {
    const { rows } = await db.query(
      `SELECT * FROM lead_analyses WHERE lead_id = $1 ORDER BY ran_at DESC`,
      [leadId],
    );
    return rows.map(mapAnalysis);
  } catch {
    return [];
  }
}

export async function updateLeadStatus(
  id: string,
  status: PipelineStatus,
): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;
  const contactStatus = STATUS_TO_CONTACT[status];
  const { rows } = await db.query(
    `UPDATE leads SET
       status = $2::pipeline_status,
       contact_status = $3::contact_status
     WHERE id = $1
     RETURNING *`,
    [id, status, contactStatus],
  );
  return rows[0] ? mapLead(rows[0]) : null;
}

/** @deprecated use updateLeadStatus */
export async function updateContactStatus(
  id: string,
  contactStatus: string,
): Promise<Lead | null> {
  const status =
    CONTACT_TO_STATUS[contactStatus as ContactStatus] ?? ("NEW" as PipelineStatus);
  return updateLeadStatus(id, status);
}

export async function persistAnalysis(
  leadId: string,
  analysis: ReturnType<typeof analyseLead>,
): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE leads SET
         score = $2,
         category = $3::lead_category,
         qualification_label = $4::qualification_label,
         ai_assessment = $5::ai_assessment,
         reasons = $6::jsonb,
         unknowns = $7::jsonb,
         pipeline_version = $8,
         last_analysed_at = NOW(),
         ai_rationale = COALESCE(
           (SELECT r->>'detail' FROM jsonb_array_elements($6::jsonb) r WHERE r->>'code' = 'rationale' LIMIT 1),
           ai_rationale
         )
       WHERE id = $1
       RETURNING *`,
      [
        leadId,
        analysis.score,
        analysis.category,
        analysis.qualification_label,
        analysis.ai_assessment,
        JSON.stringify(analysis.reasons),
        JSON.stringify(analysis.unknowns),
        analysis.pipeline_version,
      ],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `INSERT INTO lead_analyses (
         lead_id, score, category, qualification_label, ai_assessment,
         reasons, unknowns, pipeline_version
       ) VALUES (
         $1, $2, $3::lead_category, $4::qualification_label, $5::ai_assessment,
         $6::jsonb, $7::jsonb, $8
       )`,
      [
        leadId,
        analysis.score,
        analysis.category,
        analysis.qualification_label,
        analysis.ai_assessment,
        JSON.stringify(analysis.reasons),
        JSON.stringify(analysis.unknowns),
        analysis.pipeline_version,
      ],
    );
    await client.query("COMMIT");
    return mapLead(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function analyseLeadById(id: string): Promise<Lead | null> {
  const lead = await getLeadById(id);
  if (!lead) return null;
  const analysis = analyseLead(lead);
  return persistAnalysis(id, analysis);
}

export async function analyseAllLeads(): Promise<{ count: number; leads: Lead[] }> {
  const leads = await listLeads();
  const updated: Lead[] = [];
  for (const lead of leads) {
    const next = await analyseLeadById(lead.id);
    if (next) updated.push(next);
  }
  return { count: updated.length, leads: updated };
}

export interface LeadInsert {
  location: string;
  opportunity_type: string;
  land_size: string | null;
  asking_price: number | null;
  planning_status: string;
  source: string;
  source_kind?: LeadSourceKind;
  original_post_url: string | null;
  landowner_name: string | null;
  contact: string | null;
  ownership_confidence: string;
  seller_motivation: string | null;
  ai_assessment: string;
  ai_rationale: string | null;
  raw_excerpt: string | null;
  content_hash?: string | null;
  score?: number;
  category?: LeadCategory | null;
  qualification_label?: QualificationLabel;
  reasons?: ScoreReason[];
  unknowns?: string[];
}

function inferSourceKind(source: string): LeadSourceKind {
  const s = source.toLowerCase();
  if (s.includes("reddit")) return "REDDIT";
  if (s.includes("forum")) return "FORUM";
  if (
    s.includes("gumtree") ||
    s.includes("preloved") ||
    s.includes("freeads") ||
    s.includes("classified")
  ) {
    return "CLASSIFIED";
  }
  if (
    s.includes("auction") ||
    s.includes("plotfinder") ||
    s.includes("plotbrowser")
  ) {
    return "AUCTION";
  }
  if (s.includes("instant_form") || s.includes("leadgen")) return "FACEBOOK";
  if (s.includes("facebook") || s.includes("fb")) return "FACEBOOK_URL";
  if (s.includes("fixture")) return "FIXTURE";
  if (
    s.includes("google") ||
    s.includes("bing") ||
    s.includes("search") ||
    s.includes("recorded")
  ) {
    return "SEARCH";
  }
  if (s.includes("manual") || s.includes("paste") || s.includes("discovery")) {
    return s.includes("discovery") ? "AI_DISCOVERY" : "MANUAL";
  }
  return "OTHER";
}

export async function upsertLeadByUrl(
  lead: LeadInsert,
): Promise<{ lead: Lead; created: boolean } | null> {
  const db = getPool();
  if (!db) return null;

  const analysis = analyseLead({
    location: lead.location,
    land_size: lead.land_size,
    asking_price: lead.asking_price,
    planning_status: lead.planning_status,
    landowner_name: lead.landowner_name,
    contact: lead.contact,
    ownership_confidence: lead.ownership_confidence,
    seller_motivation: lead.seller_motivation,
    ai_assessment: lead.ai_assessment as AiAssessment,
    ai_rationale: lead.ai_rationale,
    source: lead.source,
    original_post_url: lead.original_post_url,
  });
  const sourceKind = lead.source_kind ?? inferSourceKind(lead.source);
  const score = lead.score ?? analysis.score;
  const category = lead.category ?? analysis.category;
  const qualification =
    lead.qualification_label ?? analysis.qualification_label;
  const reasons = lead.reasons ?? analysis.reasons;
  const unknowns = lead.unknowns ?? analysis.unknowns;

  if (lead.original_post_url) {
    const updated = await db.query(
      `UPDATE leads SET
         location = $1,
         opportunity_type = $2::opportunity_type,
         land_size = $3,
         asking_price = $4,
         planning_status = $5::planning_status,
         source = $6,
         source_kind = $7::lead_source,
         landowner_name = $8,
         contact = $9,
         ownership_confidence = $10::ownership_confidence,
         seller_motivation = $11,
         ai_assessment = $12::ai_assessment,
         ai_rationale = $13,
         raw_excerpt = $14,
         content_hash = COALESCE($15, content_hash),
         score = $16,
         category = $17::lead_category,
         qualification_label = $18::qualification_label,
         reasons = $19::jsonb,
         unknowns = $20::jsonb,
         pipeline_version = $21,
         last_analysed_at = NOW()
       WHERE original_post_url = $22
       RETURNING *`,
      [
        lead.location,
        lead.opportunity_type,
        lead.land_size,
        lead.asking_price,
        lead.planning_status,
        lead.source,
        sourceKind,
        lead.landowner_name,
        lead.contact,
        lead.ownership_confidence,
        lead.seller_motivation,
        lead.ai_assessment,
        lead.ai_rationale,
        lead.raw_excerpt,
        lead.content_hash ?? null,
        score,
        category,
        qualification,
        JSON.stringify(reasons),
        JSON.stringify(unknowns),
        PIPELINE_VERSION,
        lead.original_post_url,
      ],
    );
    if (updated.rows[0]) {
      const mapped = mapLead(updated.rows[0]);
      await db.query(
        `INSERT INTO lead_analyses (
           lead_id, score, category, qualification_label, ai_assessment,
           reasons, unknowns, pipeline_version
         ) VALUES (
           $1, $2, $3::lead_category, $4::qualification_label, $5::ai_assessment,
           $6::jsonb, $7::jsonb, $8
         )`,
        [
          mapped.id,
          score,
          category,
          qualification,
          lead.ai_assessment,
          JSON.stringify(reasons),
          JSON.stringify(unknowns),
          PIPELINE_VERSION,
        ],
      );
      return { lead: mapped, created: false };
    }
  }

  const refRes = await db.query(`SELECT next_lead_ref() AS ref`);
  const ref = refRes.rows[0].ref as string;
  const inserted = await db.query(
    `INSERT INTO leads (
       ref, location, opportunity_type, land_size, asking_price,
       planning_status, source, source_kind, original_post_url, landowner_name,
       contact, ownership_confidence, seller_motivation,
       ai_assessment, ai_rationale, raw_excerpt, content_hash,
       score, category, qualification_label, reasons, unknowns,
       pipeline_version, last_analysed_at, status
     ) VALUES (
       $1, $2, $3::opportunity_type, $4, $5,
       $6::planning_status, $7, $8::lead_source, $9, $10,
       $11, $12::ownership_confidence, $13,
       $14::ai_assessment, $15, $16, $17,
       $18, $19::lead_category, $20::qualification_label, $21::jsonb, $22::jsonb,
       $23, NOW(), 'NEW'::pipeline_status
     ) RETURNING *`,
    [
      ref,
      lead.location,
      lead.opportunity_type,
      lead.land_size,
      lead.asking_price,
      lead.planning_status,
      lead.source,
      sourceKind,
      lead.original_post_url,
      lead.landowner_name,
      lead.contact,
      lead.ownership_confidence,
      lead.seller_motivation,
      lead.ai_assessment,
      lead.ai_rationale,
      lead.raw_excerpt,
      lead.content_hash ?? null,
      score,
      category,
      qualification,
      JSON.stringify(reasons),
      JSON.stringify(unknowns),
      PIPELINE_VERSION,
    ],
  );
  const mapped = mapLead(inserted.rows[0]);
  await db.query(
    `INSERT INTO lead_analyses (
       lead_id, score, category, qualification_label, ai_assessment,
       reasons, unknowns, pipeline_version
     ) VALUES (
       $1, $2, $3::lead_category, $4::qualification_label, $5::ai_assessment,
       $6::jsonb, $7::jsonb, $8
     )`,
    [
      mapped.id,
      score,
      category,
      qualification,
      lead.ai_assessment,
      JSON.stringify(reasons),
      JSON.stringify(unknowns),
      PIPELINE_VERSION,
    ],
  );
  return { lead: mapped, created: true };
}

export async function listDiscoveryProspects(opts?: {
  pendingOnly?: boolean;
}): Promise<DiscoveryProspect[]> {
  const db = getPool();
  if (!db) return [];
  try {
    const pending = opts?.pendingOnly !== false;
    const { rows } = await db.query(
      pending
        ? `SELECT * FROM discovery_prospects WHERE imported_at IS NULL ORDER BY created_at DESC`
        : `SELECT * FROM discovery_prospects ORDER BY created_at DESC`,
    );
    return rows.map(mapProspect);
  } catch {
    return [];
  }
}

export async function getDiscoveryProspect(
  id: string,
): Promise<DiscoveryProspect | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `SELECT * FROM discovery_prospects WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapProspect(rows[0]) : null;
}

export interface DiscoveryInsert {
  title: string;
  location?: string | null;
  source: string;
  source_kind?: LeadSourceKind;
  source_url?: string | null;
  external_id?: string | null;
  snippet?: string | null;
  raw_text?: string | null;
  query?: string | null;
  content_hash?: string | null;
  preview_score?: number | null;
  preview_assessment?: AiAssessment | null;
  payload?: Record<string, unknown>;
}

export async function upsertDiscoveryProspect(
  input: DiscoveryInsert,
): Promise<{ prospect: DiscoveryProspect; created: boolean } | null> {
  const db = getPool();
  if (!db) return null;
  const sourceKind = input.source_kind ?? inferSourceKind(input.source);

  if (input.source_url) {
    const updated = await db.query(
      `UPDATE discovery_prospects SET
         title = $1,
         location = $2,
         source = $3,
         source_kind = $4::lead_source,
         snippet = $5,
         raw_text = $6,
         query = $7,
         content_hash = COALESCE($8, content_hash),
         preview_score = $9,
         preview_assessment = $10::ai_assessment,
         payload = $11::jsonb
       WHERE source_url = $12 AND imported_at IS NULL
       RETURNING *`,
      [
        input.title,
        input.location ?? null,
        input.source,
        sourceKind,
        input.snippet ?? null,
        input.raw_text ?? null,
        input.query ?? null,
        input.content_hash ?? null,
        input.preview_score ?? null,
        input.preview_assessment ?? null,
        JSON.stringify(input.payload ?? {}),
        input.source_url,
      ],
    );
    if (updated.rows[0]) {
      return { prospect: mapProspect(updated.rows[0]), created: false };
    }
  }

  try {
    const inserted = await db.query(
      `INSERT INTO discovery_prospects (
         title, location, source, source_kind, source_url, external_id,
         snippet, raw_text, query, content_hash, preview_score,
         preview_assessment, payload
       ) VALUES (
         $1, $2, $3, $4::lead_source, $5, $6,
         $7, $8, $9, $10, $11,
         $12::ai_assessment, $13::jsonb
       ) RETURNING *`,
      [
        input.title,
        input.location ?? null,
        input.source,
        sourceKind,
        input.source_url ?? null,
        input.external_id ?? null,
        input.snippet ?? null,
        input.raw_text ?? null,
        input.query ?? null,
        input.content_hash ?? null,
        input.preview_score ?? null,
        input.preview_assessment ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return { prospect: mapProspect(inserted.rows[0]), created: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("discovery_prospects_source_url_uidx")) {
      const existing = await db.query(
        `SELECT * FROM discovery_prospects WHERE source_url = $1`,
        [input.source_url],
      );
      if (existing.rows[0]) {
        return { prospect: mapProspect(existing.rows[0]), created: false };
      }
    }
    throw err;
  }
}

export async function importDiscoveryProspect(
  prospectId: string,
): Promise<{ lead: Lead; created: boolean; duplicate: boolean } | null> {
  const prospect = await getDiscoveryProspect(prospectId);
  if (!prospect) return null;
  if (prospect.imported_lead_id) {
    const existing = await getLeadById(prospect.imported_lead_id);
    if (existing) {
      return { lead: existing, created: false, duplicate: true };
    }
  }

  const payload = prospect.payload ?? {};
  const location =
    prospect.location ||
    (typeof payload.location === "string" ? payload.location : null) ||
    "Unknown location";

  const result = await upsertLeadByUrl({
    location,
    opportunity_type:
      typeof payload.opportunity_type === "string"
        ? payload.opportunity_type
        : "other",
    land_size:
      typeof payload.land_size === "string" ? payload.land_size : null,
    asking_price:
      typeof payload.asking_price === "number" ? payload.asking_price : null,
    planning_status:
      typeof payload.planning_status === "string"
        ? payload.planning_status
        : "unknown",
    source: `discovery:${prospect.source}`,
    source_kind: "AI_DISCOVERY",
    original_post_url: prospect.source_url,
    landowner_name:
      typeof payload.landowner_name === "string"
        ? payload.landowner_name
        : null,
    contact: typeof payload.contact === "string" ? payload.contact : null,
    ownership_confidence:
      typeof payload.ownership_confidence === "string"
        ? payload.ownership_confidence
        : "unknown",
    seller_motivation:
      typeof payload.seller_motivation === "string"
        ? payload.seller_motivation
        : null,
    ai_assessment: prospect.preview_assessment ?? "Investigate",
    ai_rationale:
      typeof payload.ai_rationale === "string"
        ? payload.ai_rationale
        : `Imported from discovery (${prospect.source})`,
    raw_excerpt: prospect.raw_text ?? prospect.snippet,
    content_hash: prospect.content_hash,
  });

  if (!result) return null;

  const db = getPool();
  if (db) {
    await db.query(
      `UPDATE discovery_prospects SET
         imported_at = NOW(),
         imported_lead_id = $2
       WHERE id = $1`,
      [prospectId, result.lead.id],
    );
  }

  return { ...result, duplicate: !result.created };
}
