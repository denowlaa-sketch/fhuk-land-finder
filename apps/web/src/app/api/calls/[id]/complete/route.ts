import { NextResponse } from "next/server";
import {
  completeCallAttempt,
  getLatestAttemptForLead,
} from "@/lib/facebook/calls";
import type { CallOutcomeValue } from "@/lib/twilio/script";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Complete sandbox (or in-progress) attempt.
 * Body: { answers } OR { outcome: NO_ANSWER | CALLBACK } OR { attemptId, ... }.
 * :id is the lead id (solar-compatible).
 */
export async function POST(request: Request, context: Ctx) {
  const { id: leadId } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    let attemptId =
      typeof body.attemptId === "string" ? body.attemptId : null;
    if (!attemptId) {
      const latest = await getLatestAttemptForLead(leadId);
      if (!latest || latest.status !== "IN_PROGRESS") {
        return NextResponse.json(
          { error: "No in-progress call attempt for this lead" },
          { status: 400 },
        );
      }
      attemptId = latest.id;
    }

    const outcome =
      typeof body.outcome === "string"
        ? (body.outcome as CallOutcomeValue)
        : undefined;
    const answers =
      typeof body.answers === "object" && body.answers !== null
        ? (body.answers as Record<string, string>)
        : undefined;

    if (
      outcome &&
      !["QUALIFIED", "UNQUALIFIED", "NO_ANSWER", "CALLBACK"].includes(outcome)
    ) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }

    const result = await completeCallAttempt({
      attemptId,
      answers,
      outcome,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      allowRecallWithoutConsent:
        outcome === "NO_ANSWER" || outcome === "CALLBACK",
    });

    return NextResponse.json({
      ok: true,
      lead: result.lead,
      attempt: result.attempt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("not found")
      ? 404
      : message.includes("PECR") || message.includes("consent")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
