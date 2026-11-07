import { NextResponse } from "next/server";
import { getCallQueue } from "@/lib/facebook/calls";
import { facebookConfigStatus } from "@/lib/facebook/env";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const queue = await getCallQueue();
    return NextResponse.json({
      queue,
      facebook: facebookConfigStatus(),
      twilio: twilioStatus(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, queue: [] }, { status: 500 });
  }
}
