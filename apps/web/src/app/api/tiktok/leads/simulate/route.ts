import { NextResponse } from "next/server";
import { tiktokAllowSimulate } from "@/lib/tiktok/env";
import { ingestTikTokLead } from "@/lib/tiktok/ingest";

export const dynamic = "force-dynamic";

/**
 * Local TikTok Lead Gen simulator. Always allowed in non-production;
 * production requires TIKTOK_ALLOW_SIMULATE=true.
 */
export async function POST(request: Request) {
  if (!tiktokAllowSimulate()) {
    return NextResponse.json(
      {
        error:
          "Simulate disabled — set TIKTOK_ALLOW_SIMULATE=true in production",
      },
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
  const tiktokLeadId =
    typeof record.tiktok_lead_id === "string" && record.tiktok_lead_id.trim()
      ? record.tiktok_lead_id.trim()
      : `tt_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let fieldData:
    | Record<string, string>
    | Array<{ name?: string; values?: string[]; value?: string }>;
  if (Array.isArray(record.field_data)) {
    fieldData = record.field_data as Array<{
      name?: string;
      values?: string[];
      value?: string;
    }>;
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
      "tiktok_lead_id",
      "field_data",
      "fields",
      "form_id",
      "ad_id",
      "page_id",
    ]);
    fieldData = Object.fromEntries(
      Object.entries(record)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => [k, String(v ?? "")]),
    );
  }

  try {
    const result = await ingestTikTokLead({
      tiktokLeadId,
      fieldData,
      formId:
        typeof record.form_id === "string"
          ? record.form_id
          : typeof record.page_id === "string"
            ? record.page_id
            : "tiktok_simulate_form",
      adId: typeof record.ad_id === "string" ? record.ad_id : null,
      createdTime: new Date().toISOString(),
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
