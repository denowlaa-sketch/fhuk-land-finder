import { NextResponse } from "next/server";
import { dialLiveCall } from "@/lib/facebook/calls";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Live Twilio dial — consent + TWILIO_LIVE_DIALS=true + UK E.164 required. */
export async function POST(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    const result = await dialLiveCall(id);
    return NextResponse.json({
      ok: true,
      lead: result.lead,
      attempt: result.attempt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found")
      ? 404
      : message.includes("PECR") ||
          message.includes("consent") ||
          message.includes("disabled") ||
          message.includes("not ready")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
