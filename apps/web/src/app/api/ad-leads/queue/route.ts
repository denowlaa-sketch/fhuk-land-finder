import { NextResponse } from "next/server";
import { getCallQueue } from "@/lib/facebook/calls";

export const dynamic = "force-dynamic";

/** Unified Meta + TikTok consent-gated call queue. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const channelParam = (url.searchParams.get("channel") || "all").toLowerCase();
  const channel =
    channelParam === "facebook" ||
    channelParam === "instagram" ||
    channelParam === "tiktok"
      ? channelParam
      : "all";

  try {
    const items = await getCallQueue({ channel });
    return NextResponse.json({
      ok: true,
      channel,
      count: items.length,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: message,
        hint: "Apply migrations 003_facebook_calls.sql and 004_ad_leads_channels.sql",
      },
      { status: 500 },
    );
  }
}
