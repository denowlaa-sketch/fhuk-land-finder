import { NextResponse } from "next/server";
import { tiktokConfigStatus, tiktokVerifyToken } from "@/lib/tiktok/env";
import { fetchTikTokLead, verifyTikTokSignature } from "@/lib/tiktok/graph";
import { ingestTikTokLead } from "@/lib/tiktok/ingest";

export const dynamic = "force-dynamic";

/**
 * TikTok Lead Generation webhook verification.
 * Supports hub-style challenge (verify_token + challenge) and plain echo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("verify_token") ||
    url.searchParams.get("hub.verify_token") ||
    url.searchParams.get("token");
  const challenge =
    url.searchParams.get("challenge") ||
    url.searchParams.get("hub.challenge") ||
    url.searchParams.get("echostr");
  const expected = tiktokVerifyToken();

  if (expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Health / readiness without challenge (ops).
  if (!token && !challenge) {
    const status = tiktokConfigStatus();
    return NextResponse.json({
      ok: true,
      service: "tiktok-leads",
      webhookVerifyReady: status.webhookVerifyReady,
      leadFetchReady: status.leadFetchReady,
      note: "POST lead payloads here. PECR: ingest scores only — dial requires consent_to_call.",
    });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type TikTokLeadEntry = {
  lead_id?: string;
  leadId?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  create_time?: string | number;
  created_time?: string | number;
  field_data?: Array<{ name?: string; values?: string[]; value?: string }>;
  changes?: Array<{ field?: string; name?: string; value?: string; values?: string[] }>;
  form_data?: Array<{ name?: string; value?: string }>;
};

function extractEntries(body: unknown): TikTokLeadEntry[] {
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;

  if (Array.isArray(root.entry)) {
    const out: TikTokLeadEntry[] = [];
    for (const entry of root.entry as Array<Record<string, unknown>>) {
      if (entry.lead_id || entry.leadId) {
        out.push(entry as TikTokLeadEntry);
        continue;
      }
      const changes = entry.changes;
      if (Array.isArray(changes)) {
        for (const change of changes) {
          const value =
            change && typeof change === "object" && "value" in change
              ? (change as { value?: TikTokLeadEntry }).value
              : (change as TikTokLeadEntry);
          if (value?.lead_id || value?.leadId) out.push(value);
        }
      }
    }
    return out;
  }

  if (root.lead_id || root.leadId) {
    return [root as TikTokLeadEntry];
  }

  if (Array.isArray(root.leads)) {
    return root.leads as TikTokLeadEntry[];
  }

  if (root.data && typeof root.data === "object") {
    return extractEntries(root.data);
  }

  return [];
}

/** Lead Gen webhook → optional API fetch → ingest (score only; no dial/email). */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-tiktok-signature") ||
    request.headers.get("x-tt-signature") ||
    request.headers.get("x-signature");
  if (!verifyTikTokSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = extractEntries(body);
  if (!entries.length) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      note: "No TikTok lead entries",
    });
  }

  const status = tiktokConfigStatus();
  const results: Array<{
    lead_id: string;
    ref?: string;
    created?: boolean;
    error?: string;
  }> = [];

  for (const entry of entries) {
    const leadId = String(entry.lead_id || entry.leadId || "");
    if (!leadId) {
      results.push({ lead_id: "", error: "Missing lead_id" });
      continue;
    }

    try {
      let fieldData =
        entry.field_data ||
        entry.form_data ||
        (entry.changes
          ? entry.changes.map((c) => ({
              name: c.field || c.name,
              values: c.values,
              value: c.value,
            }))
          : null);

      if (!fieldData || (Array.isArray(fieldData) && fieldData.length === 0)) {
        if (!status.leadFetchReady) {
          throw new Error(
            "Webhook had no form fields and TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID are unset — cannot fetch lead",
          );
        }
        const fetched = await fetchTikTokLead(leadId);
        fieldData = fetched.field_data;
        entry.form_id = entry.form_id || fetched.form_id || undefined;
        entry.ad_id = entry.ad_id || fetched.ad_id || undefined;
        entry.created_time =
          entry.created_time || fetched.created_time || undefined;
      }

      const ingested = await ingestTikTokLead({
        tiktokLeadId: leadId,
        fieldData: fieldData as
          | Array<{ name?: string; values?: string[]; value?: string }>
          | Record<string, string>,
        formId: entry.form_id || entry.page_id || null,
        adId: entry.ad_id ? String(entry.ad_id) : null,
        createdTime: entry.created_time
          ? String(entry.created_time)
          : entry.create_time
            ? String(entry.create_time)
            : null,
      });
      results.push({
        lead_id: leadId,
        ref: ingested.lead.ref,
        created: ingested.created,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`TikTok lead ingest failed for ${leadId}:`, message);
      results.push({ lead_id: leadId, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    ingested: results.filter((r) => !r.error).length,
    results,
  });
}
