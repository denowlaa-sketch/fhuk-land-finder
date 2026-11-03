import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { reanalyseAll, reanalyseLead } from "@/lib/leads";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (!getPool()) {
    return NextResponse.json(
      { error: "DATABASE_URL required for persistent analyse" },
      { status: 503 },
    );
  }

  try {
    if (obj.all === true) {
      const result = await reanalyseAll();
      return NextResponse.json(result);
    }
    if (typeof obj.id === "string") {
      const lead = await reanalyseLead(obj.id);
      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      return NextResponse.json({ lead });
    }
    return NextResponse.json(
      { error: "Provide { id } or { all: true }" },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyse failed";
    // Likely missing migration 002 columns/tables.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
