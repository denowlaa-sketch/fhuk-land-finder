import { getPool } from "@/lib/db";
import { assessmentFromScore } from "@/lib/scoring";
import type { Lead } from "@/lib/types";
import { STATUS_TO_CONTACT } from "@/lib/types";
import { parseFacebookLandForm } from "./parse";
import { qualifyFacebookLead } from "./qualify";
import type { FacebookLandFormAnswers } from "./types";

function parsePrice(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[£,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapLeadRow(row: Record<string, unknown>): Lead {
  // Lazy import-style mapping aligned with db.mapLead fields we care about.
  const contactStatus = (row.contact_status as string) || "Not contacted";
  return {
    id: String(row.id),
    ref: String(row.ref),
    location: String(row.location),
    opportunity_type: row.opportunity_type as Lead["opportunity_type"],
    land_size: (row.land_size as string) ?? null,
    asking_price:
      row.asking_price === null || row.asking_price === undefined
        ? null
        : Number(row.asking_price),
    planning_status: row.planning_status as Lead["planning_status"],
    source: String(row.source),
    source_kind: row.source_kind as Lead["source_kind"],
    original_post_url: (row.original_post_url as string) ?? null,
    landowner_name: (row.landowner_name as string) ?? null,
    contact: (row.contact as string) ?? null,
    ownership_confidence:
      row.ownership_confidence as Lead["ownership_confidence"],
    seller_motivation: (row.seller_motivation as string) ?? null,
    ai_assessment: row.ai_assessment as Lead["ai_assessment"],
    ai_rationale: (row.ai_rationale as string) ?? null,
    date_discovered: new Date(String(row.date_discovered)).toISOString(),
    status: row.status as Lead["status"],
    contact_status: contactStatus as Lead["contact_status"],
    score: Number(row.score ?? 0),
    category: (row.category as Lead["category"]) ?? null,
    qualification_label:
      row.qualification_label as Lead["qualification_label"],
    reasons: Array.isArray(row.reasons) ? (row.reasons as Lead["reasons"]) : [],
    unknowns: Array.isArray(row.unknowns)
      ? (row.unknowns as string[]).map(String)
      : [],
    pipeline_version: String(row.pipeline_version ?? "land-v1"),
    last_analysed_at: row.last_analysed_at
      ? new Date(String(row.last_analysed_at)).toISOString()
      : null,
    raw_excerpt: (row.raw_excerpt as string) ?? null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
    consent_to_call: Boolean(row.consent_to_call),
    consent_at: row.consent_at
      ? new Date(String(row.consent_at)).toISOString()
      : null,
    facebook_lead_id: (row.facebook_lead_id as string) ?? null,
    form_payload:
      typeof row.form_payload === "object" && row.form_payload !== null
        ? (row.form_payload as Record<string, unknown>)
        : {},
  };
}

export interface IngestFacebookLeadInput {
  facebookLeadId: string;
  fieldData:
    | Array<{ name?: string; values?: string[] }>
    | Record<string, string>;
  formId?: string | null;
  adId?: string | null;
  createdTime?: string | null;
}

export interface IngestFacebookLeadResult {
  lead: Lead;
  created: boolean;
  answers: FacebookLandFormAnswers;
  qualify: ReturnType<typeof qualifyFacebookLead>;
}

/**
 * Upsert Instant Form lead by facebook_lead_id.
 * Sets consent_to_call / consent_at only when parseYesNo === true.
 * Scores via qualifyFacebookLead — does not dial or email.
 */
export async function ingestFacebookLead(
  input: IngestFacebookLeadInput,
): Promise<IngestFacebookLeadResult> {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is required to ingest Facebook leads");
  }

  const answers = parseFacebookLandForm(input.fieldData);
  const qualify = qualifyFacebookLead(answers);
  const assessment = assessmentFromScore(qualify.score);
  const location = answers.location?.trim() || "Location unknown (Facebook form)";
  const contact =
    [answers.phone, answers.email].filter(Boolean).join(" / ") || null;
  const askingPrice = parsePrice(answers.priceExpectation);
  const planning =
    answers.planning === "unknown" ? "unknown" : answers.planning;
  const ownership =
    answers.ownershipInterest === true
      ? "likely"
      : answers.ownershipInterest === false
        ? "unknown"
        : "possible";
  const consentAt = answers.consentToCall ? new Date().toISOString() : null;
  const formPayload = {
    facebook_lead_id: input.facebookLeadId,
    form_id: input.formId ?? null,
    ad_id: input.adId ?? null,
    created_time: input.createdTime ?? null,
    answers: answers.raw,
    parsed: {
      fullName: answers.fullName,
      phone: answers.phone,
      email: answers.email,
      location: answers.location,
      plotSize: answers.plotSize,
      tenure: answers.tenure,
      planning: answers.planning,
      priceExpectation: answers.priceExpectation,
      timeline: answers.timeline,
      ownershipInterest: answers.ownershipInterest,
      consentToCall: answers.consentToCall,
    },
  };

  const existing = await db.query(
    `SELECT * FROM leads WHERE facebook_lead_id = $1`,
    [input.facebookLeadId],
  );
  if (existing.rows[0]) {
    const { rows } = await db.query(
      `UPDATE leads SET
         location = $2,
         land_size = COALESCE($3, land_size),
         asking_price = COALESCE($4, asking_price),
         planning_status = $5::planning_status,
         source = 'facebook_instant_form',
         source_kind = 'FACEBOOK'::lead_source,
         landowner_name = COALESCE($6, landowner_name),
         contact = COALESCE($7, contact),
         ownership_confidence = $8::ownership_confidence,
         seller_motivation = COALESCE($9, seller_motivation),
         ai_assessment = $10::ai_assessment,
         ai_rationale = $11,
         score = $12,
         category = $13::lead_category,
         qualification_label = $14::qualification_label,
         reasons = $15::jsonb,
         unknowns = $16::jsonb,
         pipeline_version = $17,
         last_analysed_at = NOW(),
         consent_to_call = $18,
         consent_at = CASE WHEN $18 THEN COALESCE(consent_at, $19::timestamptz) ELSE consent_at END,
         form_payload = $20::jsonb,
         raw_excerpt = $21
       WHERE facebook_lead_id = $1
       RETURNING *`,
      [
        input.facebookLeadId,
        location,
        answers.plotSize,
        askingPrice,
        planning,
        answers.fullName,
        contact,
        ownership,
        answers.timeline !== "unknown"
          ? `Timeline: ${answers.timeline}`
          : null,
        assessment,
        "Facebook Instant Form score (no dial)",
        qualify.score,
        qualify.category,
        qualify.qualification_label,
        JSON.stringify(qualify.reasons),
        JSON.stringify(qualify.unknowns),
        qualify.pipeline_version,
        answers.consentToCall,
        consentAt,
        JSON.stringify(formPayload),
        JSON.stringify(answers.raw).slice(0, 4000),
      ],
    );
    return {
      lead: mapLeadRow(rows[0]),
      created: false,
      answers,
      qualify,
    };
  }

  const refRes = await db.query(`SELECT next_lead_ref() AS ref`);
  const ref = refRes.rows[0].ref as string;
  const { rows } = await db.query(
    `INSERT INTO leads (
       ref, location, opportunity_type, land_size, asking_price,
       planning_status, source, source_kind, landowner_name, contact,
       ownership_confidence, seller_motivation, ai_assessment, ai_rationale,
       score, category, qualification_label, reasons, unknowns,
       pipeline_version, last_analysed_at, status, contact_status,
       consent_to_call, consent_at, facebook_lead_id, form_payload, raw_excerpt
     ) VALUES (
       $1, $2, 'other'::opportunity_type, $3, $4,
       $5::planning_status, 'facebook_instant_form', 'FACEBOOK'::lead_source, $6, $7,
       $8::ownership_confidence, $9, $10::ai_assessment, $11,
       $12, $13::lead_category, $14::qualification_label, $15::jsonb, $16::jsonb,
       $17, NOW(), 'NEW'::pipeline_status, $18::contact_status,
       $19, $20::timestamptz, $21, $22::jsonb, $23
     ) RETURNING *`,
    [
      ref,
      location,
      answers.plotSize,
      askingPrice,
      planning,
      answers.fullName,
      contact,
      ownership,
      answers.timeline !== "unknown" ? `Timeline: ${answers.timeline}` : null,
      assessment,
      "Facebook Instant Form score (no dial)",
      qualify.score,
      qualify.category,
      qualify.qualification_label,
      JSON.stringify(qualify.reasons),
      JSON.stringify(qualify.unknowns),
      qualify.pipeline_version,
      STATUS_TO_CONTACT.NEW,
      answers.consentToCall,
      consentAt,
      input.facebookLeadId,
      JSON.stringify(formPayload),
      JSON.stringify(answers.raw).slice(0, 4000),
    ],
  );

  await db.query(
    `INSERT INTO lead_analyses (
       lead_id, score, category, qualification_label, ai_assessment,
       reasons, unknowns, pipeline_version
     ) VALUES (
       $1, $2, $3::lead_category, $4::qualification_label, $5::ai_assessment,
       $6::jsonb, $7::jsonb, $8
     )`,
    [
      rows[0].id,
      qualify.score,
      qualify.category,
      qualify.qualification_label,
      assessment,
      JSON.stringify(qualify.reasons),
      JSON.stringify(qualify.unknowns),
      qualify.pipeline_version,
    ],
  );

  return {
    lead: mapLeadRow(rows[0]),
    created: true,
    answers,
    qualify,
  };
}
