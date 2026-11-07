import { NextResponse } from "next/server";
import { configStatus, notifyRecipients } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Owner email readiness (Strong/Investigate + QUALIFIED call alerts). */
export async function GET() {
  const status = configStatus();
  const ownerNotify = (process.env.OWNER_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return NextResponse.json({
    ...status,
    owner_notify_email: ownerNotify,
    qualified_alert_recipients:
      notifyRecipients().length > 0 ? notifyRecipients() : ownerNotify,
    note: "Customer is never emailed from the call-qualify flow. Owner-only on QUALIFIED.",
  });
}
