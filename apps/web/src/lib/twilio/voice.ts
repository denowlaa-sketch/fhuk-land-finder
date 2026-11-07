import { twilioPublicBaseUrl } from "./env";
import {
  evaluateCallOutcome,
  getStep,
  nextStepId,
  type CallAnswers,
  type ScriptStepId,
} from "./script";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlResponse(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export function buildGatherTwiml(
  attemptId: string,
  stepId: ScriptStepId,
): string {
  const step = getStep(stepId);
  if (!step) {
    return `<Response><Say>Sorry, this call cannot continue.</Say><Hangup/></Response>`;
  }
  if (step.id === "done") {
    return `<Response><Say>${escapeXml(step.prompt)}</Say><Hangup/></Response>`;
  }

  const base = twilioPublicBaseUrl();
  const action = `${base}/api/twilio/voice/${attemptId}/${stepId}`;
  const numDigits = 1;
  return `<Response>
  <Gather numDigits="${numDigits}" action="${escapeXml(action)}" method="POST" timeout="8">
    <Say>${escapeXml(step.prompt)}</Say>
  </Gather>
  <Say>We did not receive a response. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

export function applyDigit(
  answers: CallAnswers,
  stepId: ScriptStepId,
  digits: string,
): { answers: CallAnswers; next: ScriptStepId | "complete"; earlyOutcome?: ReturnType<typeof evaluateCallOutcome> } {
  const step = getStep(stepId);
  const nextAnswers = { ...answers };
  if (step?.options) {
    const match = step.options.find((o) => o.digit === digits.trim());
    nextAnswers[stepId] = match?.value ?? "unknown";
  }

  if (stepId === "intro" && nextAnswers.intro === "callback") {
    return { answers: nextAnswers, next: "complete", earlyOutcome: "CALLBACK" };
  }
  if (stepId === "interested" && nextAnswers.interested === "no") {
    return {
      answers: nextAnswers,
      next: "complete",
      earlyOutcome: "UNQUALIFIED",
    };
  }

  const next = nextStepId(stepId);
  if (!next || next === "done") {
    return { answers: nextAnswers, next: "complete" };
  }
  return { answers: nextAnswers, next };
}

export function outcomeFromAnswers(
  answers: CallAnswers,
): ReturnType<typeof evaluateCallOutcome> {
  return evaluateCallOutcome(answers);
}
