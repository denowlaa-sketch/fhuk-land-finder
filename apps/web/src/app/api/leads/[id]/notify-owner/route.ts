import { NextResponse } from "next/server";
import { notifyOwnerOfQualifiedLead } from "@/lib/facebook/calls";
import { getLeadById } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Manual re-send of owner QUALIFIED alert. Requires lead status QUALIFIED. */
export async function POST(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.status !== "QUALIFIED") {
    return NextResponse.json(
      { error: "Lead must be QUALIFIED to notify owner" },
      { status: 400 },
    );
  }
  const result = await notifyOwnerOfQualifiedLead({ lead });
  return NextResponse.json({ ok: true, notification: result });
}
