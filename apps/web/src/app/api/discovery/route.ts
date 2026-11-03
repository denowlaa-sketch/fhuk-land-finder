import { NextResponse } from "next/server";
import { fetchDiscoveryProspects } from "@/lib/discovery";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pendingOnly = url.searchParams.get("pending") !== "false";
  const { prospects, source } = await fetchDiscoveryProspects({ pendingOnly });
  return NextResponse.json({ prospects, source, count: prospects.length });
}
