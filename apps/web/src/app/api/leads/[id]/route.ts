import { NextResponse } from "next/server";
import { setLeadStatus } from "@/lib/leads";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/types";

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

  const status =
    typeof body === "object" &&
    body !== null &&
    "contact_status" in body &&
    typeof (body as { contact_status: unknown }).contact_status === "string"
      ? ((body as { contact_status: string }).contact_status as ContactStatus)
      : null;

  if (!status || !CONTACT_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "contact_status must be a valid pipeline value" },
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
