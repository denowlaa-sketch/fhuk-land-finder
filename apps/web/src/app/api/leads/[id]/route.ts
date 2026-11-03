import { NextResponse } from "next/server";
import { setLeadStatus } from "@/lib/leads";
import {
  CONTACT_STATUSES,
  CONTACT_TO_STATUS,
  PIPELINE_STATUSES,
  type ContactStatus,
  type PipelineStatus,
} from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const obj =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  let status: PipelineStatus | null = null;
  if (typeof obj.status === "string" && PIPELINE_STATUSES.includes(obj.status as PipelineStatus)) {
    status = obj.status as PipelineStatus;
  } else if (
    typeof obj.contact_status === "string" &&
    CONTACT_STATUSES.includes(obj.contact_status as ContactStatus)
  ) {
    status = CONTACT_TO_STATUS[obj.contact_status as ContactStatus];
  }

  if (!status) {
    return NextResponse.json(
      { error: "status must be a valid pipeline value (NEW…WON/LOST)" },
      { status: 400 },
    );
  }

  try {
    const lead = await setLeadStatus(id, status);
    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found or database unavailable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ lead });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
