import { NextResponse } from "next/server";
import { startSandboxCall } from "@/lib/facebook/calls";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Start sandbox call attempt — consent + phone + FACEBOOK|INSTAGRAM|TIKTOK required. */
export async function POST(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    const result = await startSandboxCall(id);
    return NextResponse.json({
      ok: true,
      lead: result.lead,
      attempt: result.attempt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found")
      ? 404
      : message.includes("PECR") || message.includes("consent") || message.includes("Only Facebook")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
