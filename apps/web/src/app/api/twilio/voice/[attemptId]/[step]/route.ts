import {
  completeCallAttempt,
  getCallAttempt,
  updateAttemptAnswers,
} from "@/lib/facebook/calls";
import {
  applyDigit,
  buildGatherTwiml,
  outcomeFromAnswers,
  twimlResponse,
} from "@/lib/twilio/voice";
import { verifyTwilioSignature } from "@/lib/twilio/signature";
import { twilioPublicBaseUrl } from "@/lib/twilio/env";
import type { ScriptStepId } from "@/lib/twilio/script";
import { getStep } from "@/lib/twilio/script";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ attemptId: string; step: string }> };

async function parseForm(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  try {
    const json = await request.json();
    if (typeof json === "object" && json !== null) {
      return Object.fromEntries(
        Object.entries(json as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v ?? ""),
        ]),
      );
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * TwiML steps + status callback.
 * step=status → handle hangup/busy/no-answer.
 * Otherwise Gather → advance script → complete with outcome.
 */
export async function POST(request: Request, context: Ctx) {
  const { attemptId, step } = await context.params;
  const params = await parseForm(request);

  const base = twilioPublicBaseUrl();
  const url = `${base}/api/twilio/voice/${attemptId}/${step}`;
  const signature = request.headers.get("x-twilio-signature");
  // Allow local/dev without signature when public base unset; require when configured.
  if (base && !verifyTwilioSignature(url, params, signature)) {
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  if (step === "status") {
    const { handleVoiceStatus } = await import("@/lib/facebook/calls");
    await handleVoiceStatus({
      attemptId,
      callStatus: params.CallStatus || params.CallStatusEvent || "unknown",
      callSid: params.CallSid,
    });
    return new Response("ok", { status: 200 });
  }

  const attempt = await getCallAttempt(attemptId);
  if (!attempt) {
    return twimlResponse(
      `<Response><Say>Call session not found.</Say><Hangup/></Response>`,
    );
  }
  if (attempt.status !== "IN_PROGRESS") {
    return twimlResponse(
      `<Response><Say>This call has already finished.</Say><Hangup/></Response>`,
    );
  }

  const stepId = step as ScriptStepId;
  if (!getStep(stepId)) {
    return twimlResponse(
      `<Response><Say>Invalid call step.</Say><Hangup/></Response>`,
    );
  }

  // First hit on intro with no Digits → play gather.
  const digits = params.Digits;
  if (!digits && stepId === "intro") {
    return twimlResponse(buildGatherTwiml(attemptId, "intro"));
  }

  if (!digits) {
    // Timeout / empty → CALLBACK recall
    await completeCallAttempt({
      attemptId,
      outcome: "CALLBACK",
      answers: attempt.answers,
      summary: `No keypad input at step ${stepId}`,
      allowRecallWithoutConsent: true,
    });
    return twimlResponse(
      `<Response><Say>We did not receive a response. Goodbye.</Say><Hangup/></Response>`,
    );
  }

  const applied = applyDigit(attempt.answers, stepId, digits);
  await updateAttemptAnswers(attemptId, applied.answers);

  if (applied.next === "complete") {
    const outcome = applied.earlyOutcome ?? outcomeFromAnswers(applied.answers);
    await completeCallAttempt({
      attemptId,
      answers: applied.answers,
      outcome,
      summary: `Live Twilio keypad outcome: ${outcome}`,
    });
    const done = getStep("done");
    return twimlResponse(
      `<Response><Say>${done?.prompt || "Thank you. Goodbye."}</Say><Hangup/></Response>`,
    );
  }

  return twimlResponse(buildGatherTwiml(attemptId, applied.next));
}
