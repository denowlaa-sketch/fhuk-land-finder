import { categoryFromScore, qualificationFromScore } from "@/lib/scoring";
import type { ScoreReason } from "@/lib/types";
import type { FacebookLandFormAnswers } from "./types";

export interface FormQualifyResult {
  score: number;
  category: ReturnType<typeof categoryFromScore>;
  qualification_label: ReturnType<typeof qualificationFromScore>;
  reasons: ScoreReason[];
  unknowns: string[];
  pipeline_version: string;
}

const FORM_PIPELINE = "land-facebook-form-1.0";

/**
 * Score Instant Form answers only — no dial, no email.
 * Consent adds points but never triggers a call by itself.
 */
export function qualifyFacebookLead(
  answers: FacebookLandFormAnswers,
): FormQualifyResult {
  let score = 35;
  const reasons: ScoreReason[] = [];
  const unknowns: string[] = [];

  if (answers.consentToCall) {
    score += 10;
    reasons.push({
      code: "consent_to_call",
      detail: "Explicit call consent on Instant Form (+10)",
      delta: 10,
    });
  } else {
    reasons.push({
      code: "consent_missing",
      detail: "No explicit call consent — PECR blocks auto-dial",
      delta: 0,
    });
  }

  if (answers.phone) {
    score += 8;
    reasons.push({ code: "phone", detail: "Phone provided (+8)", delta: 8 });
  } else {
    unknowns.push("phone");
  }

  if (answers.fullName) {
    score += 5;
    reasons.push({ code: "name", detail: "Name provided (+5)", delta: 5 });
  } else {
    unknowns.push("landowner_name");
  }

  if (answers.location) {
    score += 8;
    reasons.push({
      code: "location",
      detail: `Location: ${answers.location} (+8)`,
      delta: 8,
    });
  } else {
    unknowns.push("location");
  }

  if (answers.plotSize) {
    score += 6;
    reasons.push({
      code: "plot_size",
      detail: `Plot size: ${answers.plotSize} (+6)`,
      delta: 6,
    });
  } else {
    unknowns.push("land_size");
  }

  if (answers.ownershipInterest === true) {
    score += 12;
    reasons.push({
      code: "ownership",
      detail: "Says they own / control the land (+12)",
      delta: 12,
    });
  } else if (answers.ownershipInterest === false) {
    score -= 15;
    reasons.push({
      code: "not_owner",
      detail: "Not the landowner (−15)",
      delta: -15,
    });
  } else {
    unknowns.push("ownership_interest");
  }

  if (answers.tenure === "freehold") {
    score += 6;
    reasons.push({ code: "freehold", detail: "Freehold (+6)", delta: 6 });
  } else if (answers.tenure === "leasehold") {
    score += 2;
    reasons.push({ code: "leasehold", detail: "Leasehold (+2)", delta: 2 });
  } else {
    unknowns.push("tenure");
  }

  if (answers.planning === "outline" || answers.planning === "full") {
    score += 8;
    reasons.push({
      code: "planning",
      detail: `Planning ${answers.planning} (+8)`,
      delta: 8,
    });
  } else if (answers.planning === "pre_app") {
    score += 4;
    reasons.push({
      code: "planning_pre_app",
      detail: "Pre-app signal (+4)",
      delta: 4,
    });
  } else if (answers.planning === "unknown") {
    unknowns.push("planning_status");
  }

  if (answers.priceExpectation) {
    score += 5;
    reasons.push({
      code: "price",
      detail: `Price expectation noted (+5)`,
      delta: 5,
    });
  } else {
    unknowns.push("asking_price");
  }

  if (answers.timeline === "asap" || answers.timeline === "within_3_months") {
    score += 8;
    reasons.push({
      code: "timeline_hot",
      detail: `Timeline ${answers.timeline} (+8)`,
      delta: 8,
    });
  } else if (answers.timeline === "within_6_months") {
    score += 4;
    reasons.push({
      code: "timeline_warm",
      detail: "Timeline within 6 months (+4)",
      delta: 4,
    });
  } else if (answers.timeline === "unknown") {
    unknowns.push("timeline");
  }

  if (answers.motivation) {
    score += 5;
    reasons.push({
      code: "motivation",
      detail: `Motivation noted (+5)`,
      delta: 5,
    });
  } else {
    unknowns.push("seller_motivation");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    category: categoryFromScore(score),
    qualification_label: qualificationFromScore(score),
    reasons,
    unknowns,
    pipeline_version: FORM_PIPELINE,
  };
}
