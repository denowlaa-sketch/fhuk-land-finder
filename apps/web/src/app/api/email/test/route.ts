import { NextResponse } from "next/server";
import {
  notifyRecipients,
  sendLeadEmail,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Send a test owner notification to NOTIFY_EMAIL_TO or OWNER_NOTIFY_EMAIL. */
export async function POST() {
  const to = notifyRecipients();
  const owner = (process.env.OWNER_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length && !owner.length) {
    return NextResponse.json(
      { error: "Set NOTIFY_EMAIL_TO or OWNER_NOTIFY_EMAIL" },
      { status: 400 },
    );
  }

  // If only OWNER_NOTIFY_EMAIL, temporarily rely on sendLeadEmail path by requiring NOTIFY_EMAIL_TO.
  if (!to.length) {
    return NextResponse.json(
      {
        error:
          "Set NOTIFY_EMAIL_TO for test sends (or use QUALIFIED call completion which accepts OWNER_NOTIFY_EMAIL).",
        owner_notify_email: owner,
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendLeadEmail({
      ref: "FHUK-0000",
      location: "Test location",
      opportunity_type: "other",
      ai_assessment: "Investigate",
      source: "email_test",
      ai_rationale: "Manual email status test from /api/email/test",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
