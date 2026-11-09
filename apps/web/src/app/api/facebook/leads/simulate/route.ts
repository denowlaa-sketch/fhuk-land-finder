import { NextResponse } from "next/server";
import { facebookAllowSimulate } from "@/lib/facebook/env";
import { ingestFacebookLead } from "@/lib/facebook/ingest";

export const dynamic = "force-dynamic";

/**
 * Local Instant Form simulator. Always allowed in non-production;
 * production requires FACEBOOK_ALLOW_SIMULATE=true.
 */
export async function POST(request: Request) {
  if (!facebookAllowSimulate()) {
    return NextResponse.json(
      { error: "Simulate disabled — set FACEBOOK_ALLOW_SIMULATE=true in production" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected object body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const facebookLeadId =
    typeof record.facebook_lead_id === "string" && record.facebook_lead_id.trim()
      ? record.facebook_lead_id.trim()
      : `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const channelHint =
    typeof record.channel === "string"
      ? record.channel
      : typeof record.platform === "string"
        ? record.platform
        : null;

  // Accept either flat form fields or { fields: { ... } } / field_data array.
  let fieldData: Record<string, string> | Array<{ name?: string; values?: string[] }>;
  if (Array.isArray(record.field_data)) {
    fieldData = record.field_data as Array<{ name?: string; values?: string[] }>;
  } else if (
    typeof record.fields === "object" &&
    record.fields !== null &&
    !Array.isArray(record.fields)
  ) {
    fieldData = Object.fromEntries(
      Object.entries(record.fields as Record<string, unknown>).map(([k, v]) => [
        k,
        String(v ?? ""),
      ]),
    );
  } else {
    const skip = new Set([
      "facebook_lead_id",
      "field_data",
      "fields",
      "form_id",
      "ad_id",
      "channel",
      "platform",
    ]);
    fieldData = Object.fromEntries(
      Object.entries(record)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => [k, String(v ?? "")]),
    );
  }

  try {
    const result = await ingestFacebookLead({
      facebookLeadId,
      fieldData,
      formId:
        typeof record.form_id === "string" ? record.form_id : "simulate_form",
      adId: typeof record.ad_id === "string" ? record.ad_id : null,
      createdTime: new Date().toISOString(),
      channelHint,
    });
    return NextResponse.json({
      ok: true,
      created: result.created,
      lead: result.lead,
      answers: result.answers,
      qualify: result.qualify,
      note: "Scored only — no dial, no email. Call queue requires consent + phone.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
