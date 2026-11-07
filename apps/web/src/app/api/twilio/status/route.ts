import { NextResponse } from "next/server";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(twilioStatus());
}
