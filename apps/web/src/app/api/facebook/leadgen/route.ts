import { NextResponse } from "next/server";
import { facebookVerifyToken } from "@/lib/facebook/env";
import { fetchFacebookLead, verifyFacebookSignature } from "@/lib/facebook/graph";
import { ingestFacebookLead } from "@/lib/facebook/ingest";
import type { FacebookLeadgenEntry } from "@/lib/facebook/types";

export const dynamic = "force-dynamic";

/** Meta webhook verification (hub.challenge). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = facebookVerifyToken();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/** Leadgen webhook → Graph fetch → ingest (score only; no dial/email). */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyFacebookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries: FacebookLeadgenEntry[] = [];
  if (
    typeof body === "object" &&
    body !== null &&
    "entry" in body &&
    Array.isArray((body as { entry: unknown }).entry)
  ) {
    for (const entry of (body as { entry: Array<{ changes?: Array<{ field?: string; value?: FacebookLeadgenEntry }> }> }).entry) {
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen" && change.value?.leadgen_id) {
          entries.push(change.value);
        }
      }
    }
  }

  if (!entries.length) {
    return NextResponse.json({ ok: true, ingested: 0, note: "No leadgen entries" });
  }

  const results: Array<{ leadgen_id: string; ref?: string; created?: boolean; error?: string }> = [];
  for (const entry of entries) {
    const leadgenId = String(entry.leadgen_id);
    try {
      const graph = await fetchFacebookLead(leadgenId);
      const ingested = await ingestFacebookLead({
        facebookLeadId: graph.id || leadgenId,
        fieldData: graph.field_data ?? [],
        formId: graph.form_id ? String(graph.form_id) : entry.form_id ? String(entry.form_id) : null,
        adId: graph.ad_id ? String(graph.ad_id) : entry.ad_id ? String(entry.ad_id) : null,
        createdTime: graph.created_time ? String(graph.created_time) : null,
      });
      results.push({
        leadgen_id: leadgenId,
        ref: ingested.lead.ref,
        created: ingested.created,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Facebook leadgen ingest failed for ${leadgenId}:`, message);
      results.push({ leadgen_id: leadgenId, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    ingested: results.filter((r) => !r.error).length,
    results,
  });
}
