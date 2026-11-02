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
