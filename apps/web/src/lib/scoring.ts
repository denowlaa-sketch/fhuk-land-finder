import { GEOGRAPHY_LABEL, locationInCoverage } from "./geography";
import type {
  AiAssessment,
  LeadCategory,
  QualificationLabel,
  ScoreReason,
} from "./types";

export const PIPELINE_VERSION = "land-v1";

export interface AnalysisResult {
  score: number;
  category: LeadCategory;
  qualification_label: QualificationLabel;
  ai_assessment: AiAssessment;
  reasons: ScoreReason[];
  unknowns: string[];
  pipeline_version: string;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function categoryFromScore(score: number): LeadCategory {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function qualificationFromScore(score: number): QualificationLabel {
  if (score >= 80) return "EXCELLENT";
  if (score >= 65) return "GOOD";
  if (score >= 40) return "REVIEW";
  return "UNSUITABLE";
}

export function assessmentFromQualification(
  label: QualificationLabel,
): AiAssessment {
  if (label === "EXCELLENT" || label === "GOOD") return "Strong";
  if (label === "REVIEW" || label === "NOT_ANALYSED") return "Investigate";
  return "Reject";
}

export function assessmentFromScore(score: number): AiAssessment {
  return assessmentFromQualification(qualificationFromScore(score));
}

/** Collect honest unknowns — never invent contact / price / owner facts. */
export function collectUnknowns(input: {
  landowner_name?: string | null;
  contact?: string | null;
  asking_price?: number | null;
  land_size?: string | null;
  seller_motivation?: string | null;
  original_post_url?: string | null;
  planning_status?: string | null;
  ownership_confidence?: string | null;
}): string[] {
  const unknowns: string[] = [];
  if (!input.landowner_name) unknowns.push("landowner_name");
  if (!input.contact) unknowns.push("contact");
  if (input.asking_price === null || input.asking_price === undefined) {
    unknowns.push("asking_price");
  }
  if (!input.land_size) unknowns.push("land_size");
  if (!input.seller_motivation) unknowns.push("seller_motivation");
  if (!input.original_post_url) unknowns.push("original_post_url");
  if (!input.planning_status || input.planning_status === "unknown") {
    unknowns.push("planning_status");
  }
  if (!input.ownership_confidence || input.ownership_confidence === "unknown") {
    unknowns.push("ownership_confidence");
  }
  return unknowns;
}

export interface AnalyseLeadInput {
  location?: string | null;
  land_size?: string | null;
  asking_price?: number | null;
  planning_status?: string | null;
  landowner_name?: string | null;
  contact?: string | null;
  ownership_confidence?: string | null;
  seller_motivation?: string | null;
  ai_assessment?: AiAssessment | null;
  ai_rationale?: string | null;
  source?: string | null;
  original_post_url?: string | null;
}

/**
 * Deterministic land rule scorer (Solar-style reasons + unknowns).
 * LLM extract should fill structured facts first; this never invents contacts.
 */
export function analyseLead(lead: AnalyseLeadInput): AnalysisResult {
  const reasons: ScoreReason[] = [];
  let score = 40;

  const ownership = lead.ownership_confidence ?? "unknown";
  if (ownership === "confirmed") {
    score += 20;
    reasons.push({
      code: "ownership_confirmed",
      detail: "Ownership confidence confirmed",
      delta: 20,
    });
  } else if (ownership === "likely") {
    score += 12;
    reasons.push({
      code: "ownership_likely",
      detail: "Ownership confidence likely",
      delta: 12,
    });
  } else if (ownership === "possible") {
    score += 4;
    reasons.push({
      code: "ownership_possible",
      detail: "Ownership confidence only possible",
      delta: 4,
    });
  } else {
    score -= 8;
    reasons.push({
      code: "ownership_unknown",
      detail: "Ownership unknown — data confidence penalty",
      delta: -8,
    });
  }

  if (lead.contact) {
    score += 12;
    reasons.push({
      code: "contact_present",
      detail: "Published contact details present",
      delta: 12,
    });
  } else {
    score -= 6;
    reasons.push({
      code: "contact_missing",
      detail: "No published contact — marked Unknown",
      delta: -6,
    });
  }

  if (lead.seller_motivation) {
    score += 8;
    reasons.push({
      code: "motivation_signal",
      detail: "Seller motivation signal present",
      delta: 8,
    });
  }

  const planning = lead.planning_status ?? "unknown";
  if (planning === "outline" || planning === "full") {
    score += 10;
    reasons.push({
      code: "planning_positive",
      detail: `Planning status ${planning}`,
      delta: 10,
    });
  } else if (planning === "pre_app") {
    score += 5;
    reasons.push({
      code: "planning_pre_app",
      detail: "Pre-application planning signal",
      delta: 5,
    });
  } else if (planning === "none") {
    score += 2;
    reasons.push({
      code: "planning_none",
      detail: "No planning yet (common for off-market)",
      delta: 2,
    });
  }

  if (lead.land_size) {
    score += 5;
    reasons.push({
      code: "size_known",
      detail: `Plot size noted: ${lead.land_size}`,
      delta: 5,
    });
  }

  if (lead.asking_price != null) {
    score += 3;
    reasons.push({
      code: "price_known",
      detail: "Asking price published",
      delta: 3,
    });
  }

  if (locationInCoverage(lead.location)) {
    score += 6;
    reasons.push({
      code: "coverage_location",
      detail: GEOGRAPHY_LABEL,
      delta: 6,
    });
  }

  const src = (lead.source ?? "").toLowerCase();
  if (src.includes("auction") || src.includes("plotfinder")) {
    score += 4;
    reasons.push({
      code: "source_trust_auction",
      detail: "Auction / specialist land source",
      delta: 4,
    });
  } else if (src.includes("fixture") || src.includes("recorded")) {
    reasons.push({
      code: "source_demo",
      detail: "Demo / recorded source — treat as sample data",
      delta: 0,
    });
  }

  // Honour explicit LLM assessment as a soft prior (does not invent facts).
  if (lead.ai_assessment === "Strong") {
    score += 8;
    reasons.push({
      code: "llm_strong",
      detail: "Model assessment Strong",
      delta: 8,
    });
  } else if (lead.ai_assessment === "Reject") {
    score -= 15;
    reasons.push({
      code: "llm_reject",
      detail: "Model assessment Reject",
      delta: -15,
    });
  } else if (lead.ai_assessment === "Investigate") {
    reasons.push({
      code: "llm_investigate",
      detail: "Model assessment Investigate",
      delta: 0,
    });
  }

  if (lead.ai_rationale) {
    reasons.push({
      code: "rationale",
      detail: lead.ai_rationale,
      delta: 0,
    });
  }

  const unknowns = collectUnknowns(lead);
  // Data-confidence penalty for sparse rows.
  const unknownPenalty = Math.min(12, unknowns.length * 2);
  if (unknownPenalty > 0) {
    score -= unknownPenalty;
    reasons.push({
      code: "unknown_penalty",
      detail: `${unknowns.length} unknown field(s) — confidence penalty`,
      delta: -unknownPenalty,
    });
  }

  const finalScore = clamp(score);
  const qualification_label = qualificationFromScore(finalScore);
  const category = categoryFromScore(finalScore);
  const ai_assessment =
    lead.ai_assessment ?? assessmentFromQualification(qualification_label);

  return {
    score: finalScore,
    category,
    qualification_label,
    ai_assessment,
    reasons,
    unknowns,
    pipeline_version: PIPELINE_VERSION,
  };
}
