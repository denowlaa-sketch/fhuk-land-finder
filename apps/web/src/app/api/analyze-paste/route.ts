import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { upsertLeadByUrl } from "@/lib/db";
import { analyzePaste } from "@/lib/facebookPaste";

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

    return NextResponse.json({
      analysis,
      saved: true,
      created: result.created,
      lead: result.lead,
      note: "Facebook URL is metadata only — never fetched or scraped.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyse failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
