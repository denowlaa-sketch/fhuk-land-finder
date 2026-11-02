import { Pool, type QueryResultRow } from "pg";
import type { Lead } from "./types";

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

function mapLead(row: QueryResultRow): Lead {
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
    original_post_url: row.original_post_url,
    landowner_name: row.landowner_name,
    contact: row.contact,
    ownership_confidence: row.ownership_confidence,
    seller_motivation: row.seller_motivation,
    ai_assessment: row.ai_assessment,
    ai_rationale: row.ai_rationale,
    date_discovered: new Date(row.date_discovered).toISOString(),
    contact_status: row.contact_status,
    raw_excerpt: row.raw_excerpt,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export async function listLeads(): Promise<Lead[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `SELECT * FROM leads ORDER BY date_discovered DESC, ref ASC`,
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

export async function updateContactStatus(
  id: string,
  contactStatus: string,
): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `UPDATE leads SET contact_status = $2::contact_status
     WHERE id = $1
     RETURNING *`,
    [id, contactStatus],
  );
  return rows[0] ? mapLead(rows[0]) : null;
}

export interface LeadInsert {
  location: string;
  opportunity_type: string;
  land_size: string | null;
  asking_price: number | null;
  planning_status: string;
  source: string;
  original_post_url: string | null;
  landowner_name: string | null;
  contact: string | null;
  ownership_confidence: string;
  seller_motivation: string | null;
  ai_assessment: string;
  ai_rationale: string | null;
  raw_excerpt: string | null;
  content_hash?: string | null;
}

export async function upsertLeadByUrl(
  lead: LeadInsert,
): Promise<{ lead: Lead; created: boolean } | null> {
  const db = getPool();
  if (!db) return null;

  if (lead.original_post_url) {
    const updated = await db.query(
      `UPDATE leads SET
         location = $1,
         opportunity_type = $2::opportunity_type,
         land_size = $3,
         asking_price = $4,
         planning_status = $5::planning_status,
         source = $6,
         landowner_name = $7,
         contact = $8,
         ownership_confidence = $9::ownership_confidence,
         seller_motivation = $10,
         ai_assessment = $11::ai_assessment,
         ai_rationale = $12,
         raw_excerpt = $13,
         content_hash = COALESCE($14, content_hash)
       WHERE original_post_url = $15
       RETURNING *`,
      [
        lead.location,
        lead.opportunity_type,
        lead.land_size,
        lead.asking_price,
        lead.planning_status,
        lead.source,
        lead.landowner_name,
        lead.contact,
        lead.ownership_confidence,
        lead.seller_motivation,
        lead.ai_assessment,
        lead.ai_rationale,
        lead.raw_excerpt,
        lead.content_hash ?? null,
        lead.original_post_url,
      ],
    );
    if (updated.rows[0]) {
      return { lead: mapLead(updated.rows[0]), created: false };
    }
  }

  const refRes = await db.query(`SELECT next_lead_ref() AS ref`);
  const ref = refRes.rows[0].ref as string;
  const inserted = await db.query(
    `INSERT INTO leads (
       ref, location, opportunity_type, land_size, asking_price,
       planning_status, source, original_post_url, landowner_name,
       contact, ownership_confidence, seller_motivation,
       ai_assessment, ai_rationale, raw_excerpt, content_hash
     ) VALUES (
       $1, $2, $3::opportunity_type, $4, $5,
       $6::planning_status, $7, $8, $9,
       $10, $11::ownership_confidence, $12,
       $13::ai_assessment, $14, $15, $16
     ) RETURNING *`,
    [
      ref,
      lead.location,
      lead.opportunity_type,
      lead.land_size,
      lead.asking_price,
      lead.planning_status,
      lead.source,
      lead.original_post_url,
      lead.landowner_name,
      lead.contact,
      lead.ownership_confidence,
      lead.seller_motivation,
      lead.ai_assessment,
      lead.ai_rationale,
      lead.raw_excerpt,
      lead.content_hash ?? null,
    ],
  );
  return { lead: mapLead(inserted.rows[0]), created: true };
}
