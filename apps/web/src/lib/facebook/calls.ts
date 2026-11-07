import { getPool } from "@/lib/db";
import {
  leadBodyText,
  leadSubject,
  notifyFrom,
  notifyMode,
  notifyProvider,
  notifyRecipients,
  sendLeadEmail,
  type LeadNotifyPayload,
} from "@/lib/notify";
import type { Lead, PipelineStatus } from "@/lib/types";
import { STATUS_TO_CONTACT } from "@/lib/types";
import { placeTwilioCall } from "@/lib/twilio/place-call";
import { assertDialableUkPhone, extractPhone } from "@/lib/twilio/phone";
import { twilioStatus } from "@/lib/twilio/env";
import {
  evaluateCallOutcome,
  type CallAnswers,
  type CallOutcomeValue,
} from "@/lib/twilio/script";

export type CallAttemptMode = "SANDBOX" | "LIVE";
export type CallAttemptStatus = "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export interface CallAttempt {
  id: string;
  lead_id: string;
  mode: CallAttemptMode;
  status: CallAttemptStatus;
  outcome: CallOutcomeValue | null;
  summary: string | null;
  answers: CallAnswers;
  twilio_call_sid: string | null;
  twilio_status: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallQueueItem extends Lead {
  latest_attempt: CallAttempt | null;
  phone: string | null;
}

function mapAttempt(row: Record<string, unknown>): CallAttempt {
  const answers =
    typeof row.answers === "object" && row.answers !== null && !Array.isArray(row.answers)
      ? (row.answers as CallAnswers)
      : typeof row.answers === "string"
        ? (JSON.parse(row.answers) as CallAnswers)
        : {};
  return {
    id: String(row.id),
    lead_id: String(row.lead_id),
    mode: row.mode as CallAttemptMode,
    status: row.status as CallAttemptStatus,
    outcome: (row.outcome as CallOutcomeValue) ?? null,
    summary: (row.summary as string) ?? null,
    answers,
    twilio_call_sid: (row.twilio_call_sid as string) ?? null,
    twilio_status: (row.twilio_status as string) ?? null,
    error_message: (row.error_message as string) ?? null,
    started_at: new Date(String(row.started_at)).toISOString(),
    completed_at: row.completed_at
      ? new Date(String(row.completed_at)).toISOString()
      : null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    ref: String(row.ref),
    location: String(row.location),
    opportunity_type: row.opportunity_type as Lead["opportunity_type"],
    land_size: (row.land_size as string) ?? null,
    asking_price:
      row.asking_price == null ? null : Number(row.asking_price),
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
    contact_status: row.contact_status as Lead["contact_status"],
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

async function getLeadRow(leadId: string): Promise<Lead | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  return rows[0] ? mapLead(rows[0]) : null;
}

/** PECR hard gate before any sandbox or live dial. */
export function assertCanStartCall(lead: Lead): void {
  if (lead.source_kind !== "FACEBOOK") {
    throw new Error("Only Facebook Instant Form leads may enter the call queue");
  }
  if (!lead.consent_to_call) {
    throw new Error("PECR: recorded call consent is required before dialling");
  }
  if (!extractPhone(lead.contact)) {
    throw new Error("Lead has no phone number");
  }
  if (lead.status === "WON" || lead.status === "LOST") {
    throw new Error(`Lead status ${lead.status} is closed — cannot dial`);
  }
}

/**
 * Queue = FACEBOOK Instant Form + consent + phone + NEW|CONTACTED.
 * NO_ANSWER / CALLBACK leave CONTACTED so leads reappear (recall).
 */
export async function getCallQueue(): Promise<CallQueueItem[]> {
  const db = getPool();
  if (!db) return [];

  const { rows } = await db.query(
    `SELECT l.*,
       (
         SELECT row_to_json(ca)
         FROM (
           SELECT * FROM call_attempts
           WHERE lead_id = l.id
           ORDER BY started_at DESC
           LIMIT 1
         ) ca
       ) AS latest_attempt_json
     FROM leads l
     WHERE l.source_kind = 'FACEBOOK'::lead_source
       AND l.consent_to_call = TRUE
       AND l.status IN ('NEW'::pipeline_status, 'CONTACTED'::pipeline_status)
       AND COALESCE(l.contact, '') <> ''
     ORDER BY l.date_discovered DESC`,
  );

  return rows.map((row) => {
    const lead = mapLead(row);
    let latest: CallAttempt | null = null;
    if (row.latest_attempt_json) {
      latest = mapAttempt(row.latest_attempt_json as Record<string, unknown>);
    }
    return {
      ...lead,
      latest_attempt: latest,
      phone: extractPhone(lead.contact),
    };
  });
}

export async function getCallAttempt(id: string): Promise<CallAttempt | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(`SELECT * FROM call_attempts WHERE id = $1`, [
    id,
  ]);
  return rows[0] ? mapAttempt(rows[0]) : null;
}

export async function getLatestAttemptForLead(
  leadId: string,
): Promise<CallAttempt | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `SELECT * FROM call_attempts WHERE lead_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [leadId],
  );
  return rows[0] ? mapAttempt(rows[0]) : null;
}

async function setLeadPipeline(leadId: string, status: PipelineStatus) {
  const db = getPool();
  if (!db) return;
  await db.query(
    `UPDATE leads SET
       status = $2::pipeline_status,
       contact_status = $3::contact_status
     WHERE id = $1`,
    [leadId, status, STATUS_TO_CONTACT[status]],
  );
}

export async function startSandboxCall(leadId: string): Promise<{
  lead: Lead;
  attempt: CallAttempt;
}> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL required");
  const lead = await getLeadRow(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCanStartCall(lead);

  const { rows } = await db.query(
    `INSERT INTO call_attempts (lead_id, mode, status)
     VALUES ($1, 'SANDBOX'::call_attempt_mode, 'IN_PROGRESS'::call_attempt_status)
     RETURNING *`,
    [leadId],
  );
  await setLeadPipeline(leadId, "CONTACTED");
  const updated = await getLeadRow(leadId);
  return { lead: updated!, attempt: mapAttempt(rows[0]) };
}

export async function dialLiveCall(leadId: string): Promise<{
  lead: Lead;
  attempt: CallAttempt;
}> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL required");
  const lead = await getLeadRow(leadId);
  if (!lead) throw new Error("Lead not found");
  assertCanStartCall(lead);

  const status = twilioStatus();
  if (!status.ready) {
    throw new Error(
      "Live dials disabled — configure Twilio and set TWILIO_LIVE_DIALS=true",
    );
  }

  const to = assertDialableUkPhone(lead.contact);
  const { rows } = await db.query(
    `INSERT INTO call_attempts (lead_id, mode, status)
     VALUES ($1, 'LIVE'::call_attempt_mode, 'IN_PROGRESS'::call_attempt_status)
     RETURNING *`,
    [leadId],
  );
  const attempt = mapAttempt(rows[0]);

  try {
    const call = await placeTwilioCall({ toE164: to, attemptId: attempt.id });
    const updated = await db.query(
      `UPDATE call_attempts SET
         twilio_call_sid = $2,
         twilio_status = $3
       WHERE id = $1
       RETURNING *`,
      [attempt.id, call.sid, call.status],
    );
    await setLeadPipeline(leadId, "CONTACTED");
    return {
      lead: (await getLeadRow(leadId))!,
      attempt: mapAttempt(updated.rows[0]),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.query(
      `UPDATE call_attempts SET
         status = 'BLOCKED'::call_attempt_status,
         error_message = $2,
         completed_at = NOW()
       WHERE id = $1`,
      [attempt.id, message],
    );
    throw err;
  }
}

function outcomeToStatus(outcome: CallOutcomeValue): PipelineStatus {
  if (outcome === "QUALIFIED") return "QUALIFIED";
  if (outcome === "UNQUALIFIED") return "LOST";
  // NO_ANSWER / CALLBACK stay CONTACTED → recall-eligible
  return "CONTACTED";
}

export async function notifyOwnerOfQualifiedLead(opts: {
  lead: Lead;
  attemptId?: string | null;
}): Promise<{ status: "sent" | "sandbox" | "failed"; detail?: string }> {
  const db = getPool();
  const payload: LeadNotifyPayload = {
    ref: opts.lead.ref,
    location: opts.lead.location,
    opportunity_type: opts.lead.opportunity_type,
    ai_assessment: "Strong",
    source: opts.lead.source,
    original_post_url: opts.lead.original_post_url,
    ai_rationale: `Call-qualified Facebook Instant Form lead (${opts.lead.ref})`,
  };

  const recipients = notifyRecipients();
  // Prefer NOTIFY_EMAIL_TO; fall back to OWNER_NOTIFY_EMAIL (solar naming).
  const to =
    recipients.length > 0
      ? recipients
      : (process.env.OWNER_NOTIFY_EMAIL || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  if (!to.length) {
    if (db) {
      await db.query(
        `INSERT INTO owner_notifications (lead_id, call_attempt_id, status, to_address, subject, detail)
         VALUES ($1, $2, 'sandbox'::owner_notification_status, NULL, $3, $4)`,
        [
          opts.lead.id,
          opts.attemptId ?? null,
          leadSubject({ ...payload, ai_assessment: "QUALIFIED" }),
          "OWNER_NOTIFY_EMAIL / NOTIFY_EMAIL_TO unset — sandbox",
        ],
      );
    }
    return { status: "sandbox", detail: "No owner email configured" };
  }

  // Temporarily force recipients via env-compatible path: sendLeadEmail uses notifyRecipients().
  // If only OWNER_NOTIFY_EMAIL is set, use a direct send path.
  try {
    let result;
    if (recipients.length) {
      // Gate: enable send for QUALIFIED owner alerts even if Strong/Investigate notify is off,
      // unless NOTIFY_EMAIL_MODE is dry-run (then sandbox).
      if (notifyMode() === "dry-run" && !process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) {
        console.info(
          "OWNER notify sandbox (dry-run / no provider key):",
          leadSubject({ ...payload, ai_assessment: "QUALIFIED" }),
        );
        if (db) {
          await db.query(
            `INSERT INTO owner_notifications (lead_id, call_attempt_id, status, to_address, subject, detail)
             VALUES ($1, $2, 'sandbox'::owner_notification_status, $3, $4, $5)`,
            [
              opts.lead.id,
              opts.attemptId ?? null,
              to.join(","),
              `[FHUK Land Finder] QUALIFIED lead ${opts.lead.ref} — ${opts.lead.location}`,
              leadBodyText(payload),
            ],
          );
        }
        return { status: "sandbox", detail: "dry-run or missing provider key" };
      }
      result = await sendLeadEmail({
        ...payload,
        ai_assessment: "QUALIFIED",
      });
    } else {
      // OWNER_NOTIFY_EMAIL only — use Resend if available.
      const apiKey = process.env.RESEND_API_KEY;
      const subject = `[FHUK Land Finder] QUALIFIED lead ${opts.lead.ref} — ${opts.lead.location}`;
      if (!apiKey || notifyMode() === "dry-run") {
        console.info("OWNER notify sandbox:", { to, subject });
        if (db) {
          await db.query(
            `INSERT INTO owner_notifications (lead_id, call_attempt_id, status, to_address, subject, detail)
             VALUES ($1, $2, 'sandbox'::owner_notification_status, $3, $4, $5)`,
            [
              opts.lead.id,
              opts.attemptId ?? null,
              to.join(","),
              subject,
              leadBodyText(payload),
            ],
          );
        }
        return { status: "sandbox" };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: notifyFrom(),
          to,
          subject,
          text: leadBodyText({ ...payload, ai_assessment: "QUALIFIED" }),
        }),
      });
      const response = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(JSON.stringify(response));
      result = {
        sent: true,
        dry_run: false,
        to,
        subject,
        response,
      };
    }

    const notifStatus =
      result.dry_run || !result.sent ? "sandbox" : "sent";
    if (db) {
      await db.query(
        `INSERT INTO owner_notifications (
           lead_id, call_attempt_id, status, to_address, subject, detail, provider_response
         ) VALUES (
           $1, $2, $3::owner_notification_status, $4, $5, $6, $7::jsonb
         )`,
        [
          opts.lead.id,
          opts.attemptId ?? null,
          notifStatus,
          (result.to || to).join(","),
          result.subject,
          leadBodyText({ ...payload, ai_assessment: "QUALIFIED" }),
          JSON.stringify(result.response ?? { provider: notifyProvider() }),
        ],
      );
    }
    return { status: notifStatus };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (db) {
      await db.query(
        `INSERT INTO owner_notifications (lead_id, call_attempt_id, status, to_address, subject, detail)
         VALUES ($1, $2, 'failed'::owner_notification_status, $3, $4, $5)`,
        [
          opts.lead.id,
          opts.attemptId ?? null,
          to.join(","),
          `[FHUK Land Finder] QUALIFIED lead ${opts.lead.ref}`,
          message,
        ],
      );
    }
    return { status: "failed", detail: message };
  }
}

export async function completeCallAttempt(opts: {
  attemptId: string;
  answers?: CallAnswers;
  outcome?: CallOutcomeValue;
  summary?: string;
  /** Allow NO_ANSWER/CALLBACK without re-checking consent (Twilio status edge). */
  allowRecallWithoutConsent?: boolean;
}): Promise<{ lead: Lead; attempt: CallAttempt }> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL required");

  const attempt = await getCallAttempt(opts.attemptId);
  if (!attempt) throw new Error("Call attempt not found");
  if (attempt.status === "COMPLETED") {
    const lead = await getLeadRow(attempt.lead_id);
    return { lead: lead!, attempt };
  }

  const lead = await getLeadRow(attempt.lead_id);
  if (!lead) throw new Error("Lead not found");

  const outcome: CallOutcomeValue =
    opts.outcome ??
    (opts.answers ? evaluateCallOutcome(opts.answers) : "CALLBACK");

  if (
    !lead.consent_to_call &&
    !(
      opts.allowRecallWithoutConsent &&
      (outcome === "NO_ANSWER" || outcome === "CALLBACK")
    )
  ) {
    throw new Error("PECR: cannot complete qualify call without consent");
  }

  const answers = opts.answers ?? attempt.answers;
  const { rows } = await db.query(
    `UPDATE call_attempts SET
       status = 'COMPLETED'::call_attempt_status,
       outcome = $2::call_outcome,
       answers = $3::jsonb,
       summary = $4,
       completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      opts.attemptId,
      outcome,
      JSON.stringify(answers),
      opts.summary ?? `Outcome: ${outcome}`,
    ],
  );

  const nextStatus = outcomeToStatus(outcome);
  await setLeadPipeline(lead.id, nextStatus);
  const updatedLead = (await getLeadRow(lead.id))!;

  if (outcome === "QUALIFIED") {
    await notifyOwnerOfQualifiedLead({
      lead: updatedLead,
      attemptId: opts.attemptId,
    });
  }

  return { lead: updatedLead, attempt: mapAttempt(rows[0]) };
}

/** Twilio status callback: busy / no-answer / failed → NO_ANSWER; other incomplete → CALLBACK. */
export async function handleVoiceStatus(opts: {
  attemptId: string;
  callStatus: string;
  callSid?: string;
}): Promise<CallAttempt | null> {
  const db = getPool();
  if (!db) return null;
  const attempt = await getCallAttempt(opts.attemptId);
  if (!attempt || attempt.status === "COMPLETED") return attempt;

  if (opts.callSid) {
    await db.query(
      `UPDATE call_attempts SET twilio_call_sid = COALESCE(twilio_call_sid, $2), twilio_status = $3 WHERE id = $1`,
      [opts.attemptId, opts.callSid, opts.callStatus],
    );
  } else {
    await db.query(
      `UPDATE call_attempts SET twilio_status = $2 WHERE id = $1`,
      [opts.attemptId, opts.callStatus],
    );
  }

  const status = opts.callStatus.toLowerCase();
  if (["busy", "no-answer", "failed", "canceled"].includes(status)) {
    const { attempt: done } = await completeCallAttempt({
      attemptId: opts.attemptId,
      outcome: "NO_ANSWER",
      summary: `Twilio status: ${opts.callStatus}`,
      allowRecallWithoutConsent: true,
    });
    return done;
  }

  if (status === "completed" && attempt.status === "IN_PROGRESS") {
    // Hangup before full keypad answers → CALLBACK (recall)
    const { attempt: done } = await completeCallAttempt({
      attemptId: opts.attemptId,
      outcome: "CALLBACK",
      answers: attempt.answers,
      summary: "Call ended before full qualify script",
      allowRecallWithoutConsent: true,
    });
    return done;
  }

  return getCallAttempt(opts.attemptId);
}

export async function updateAttemptAnswers(
  attemptId: string,
  answers: CallAnswers,
): Promise<CallAttempt | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `UPDATE call_attempts SET answers = $2::jsonb WHERE id = $1 RETURNING *`,
    [attemptId, JSON.stringify(answers)],
  );
  return rows[0] ? mapAttempt(rows[0]) : null;
}
