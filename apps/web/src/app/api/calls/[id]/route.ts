import { NextResponse } from "next/server";
import { getLatestAttemptForLead } from "@/lib/facebook/calls";
import { getLeadById } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Latest call attempt status for a lead. */
export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  const attempt = await getLatestAttemptForLead(id);
  return NextResponse.json({
    lead: {
      id: lead.id,
      ref: lead.ref,
      status: lead.status,
      consent_to_call: lead.consent_to_call ?? false,
      source_kind: lead.source_kind,
      contact: lead.contact,
    },
    attempt,
  });
}
