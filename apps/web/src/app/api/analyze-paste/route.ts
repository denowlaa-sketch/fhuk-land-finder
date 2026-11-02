import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { upsertLeadByUrl } from "@/lib/db";
import { analyzePaste } from "@/lib/facebookPaste";
import { maybeNotifyLead } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url.trim() || null
      : null;
  const text =
    typeof body === "object" &&
    body !== null &&
    "text" in body &&
    typeof (body as { text: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";
  const save =
    typeof body === "object" &&
    body !== null &&
    "save" in body &&
    Boolean((body as { save: unknown }).save);
  const notifyRequested =
    typeof body === "object" &&
    body !== null &&
    "notify" in body
      ? Boolean((body as { notify: unknown }).notify)
      : true;

  try {
    const analysis = await analyzePaste(text, url);
    const content_hash = createHash("sha256")
      .update(
        analysis.original_post_url
          ? `url:${analysis.original_post_url.toLowerCase()}`
          : `ex:${analysis.raw_excerpt.slice(0, 500).toLowerCase()}`,
      )
      .digest("hex");

    if (!save) {
      return NextResponse.json({
        analysis,
        saved: false,
        note: "Facebook URL is metadata only — never fetched or scraped.",
      });
    }

    const result = await upsertLeadByUrl({
      ...analysis,
      content_hash,
    });

    if (!result) {
      return NextResponse.json(
        {
          analysis,
          saved: false,
          error:
            "DATABASE_URL not configured — analysis only (fixture/demo mode).",
          note: "Facebook URL is metadata only — never fetched or scraped.",
        },
        { status: 200 },
      );
    }

    const notify = notifyRequested
      ? await maybeNotifyLead({
          ref: result.lead.ref,
          location: result.lead.location,
          opportunity_type: result.lead.opportunity_type,
          ai_assessment: result.lead.ai_assessment,
          source: result.lead.source,
          original_post_url: result.lead.original_post_url,
          ai_rationale: result.lead.ai_rationale,
          created: result.created,
        })
      : { skipped: true, reason: "Dashboard paste notify toggle off" };

    return NextResponse.json({
      analysis,
      saved: true,
      created: result.created,
      lead: result.lead,
      notify: notify ?? null,
      note: "Facebook URL is metadata only — never fetched or scraped.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyse failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
