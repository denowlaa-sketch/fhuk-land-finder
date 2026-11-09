import { NextResponse } from "next/server";
import { getCallQueue } from "@/lib/facebook/calls";
import { facebookConfigStatus } from "@/lib/facebook/env";
import { tiktokConfigStatus } from "@/lib/tiktok/env";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

/** @deprecated Prefer GET /api/ad-leads/queue — kept for backwards compatibility. */
export async function GET() {
  try {
    const queue = await getCallQueue();
    return NextResponse.json({
      queue,
      facebook: facebookConfigStatus(),
      tiktok: tiktokConfigStatus(),
      twilio: twilioStatus(),
      note: "Prefer /api/ad-leads/queue and UI /ad-leads",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, queue: [] }, { status: 500 });
  }
}
