export type OpportunityType =
  | "backland"
  | "garden_plot"
  | "brownfield"
  | "infill"
  | "agricultural"
  | "other";

export type PlanningStatus =
  | "none"
  | "pre_app"
  | "outline"
  | "full"
  | "expired"
  | "unknown";

export type OwnershipConfidence =
  | "confirmed"
  | "likely"
  | "possible"
  | "unknown";

/** Land assessment labels — mapped onto qualification. */
export type AiAssessment = "Strong" | "Investigate" | "Reject";

/** Solar-style CRM pipeline. */
export type PipelineStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

/** @deprecated Prefer PipelineStatus; kept for migration compatibility. */
export type ContactStatus =
  | "Not contacted"
  | "Contacted"
  | "Interested"
  | "Negotiating"
  | "Under offer"
  | "Rejected";

export const CONTACT_STATUSES: ContactStatus[] = [
  "Not contacted",
  "Contacted",
  "Interested",
  "Negotiating",
  "Under offer",
  "Rejected",
];

export type LeadCategory = "A" | "B" | "C" | "D";

export type QualificationLabel =
  | "EXCELLENT"
  | "GOOD"
  | "REVIEW"
  | "UNSUITABLE"
  | "NOT_ANALYSED";

export const QUALIFICATION_LABELS: QualificationLabel[] = [
  "EXCELLENT",
  "GOOD",
  "REVIEW",
  "UNSUITABLE",
  "NOT_ANALYSED",
];

export type LeadSourceKind =
  | "SEARCH"
  | "REDDIT"
  | "FORUM"
  | "CLASSIFIED"
  | "AUCTION"
  | "FACEBOOK_URL"
  | "FIXTURE"
  | "MANUAL"
  | "AI_DISCOVERY"
  | "OTHER";

export interface ScoreReason {
  code: string;
  detail: string;
  delta?: number;
}

export interface Lead {
  id: string;
  ref: string;
  location: string;
  opportunity_type: OpportunityType;
  land_size: string | null;
  asking_price: number | null;
  planning_status: PlanningStatus;
  source: string;
  source_kind: LeadSourceKind;
  original_post_url: string | null;
  landowner_name: string | null;
  contact: string | null;
  ownership_confidence: OwnershipConfidence;
  seller_motivation: string | null;
  ai_assessment: AiAssessment;
  ai_rationale: string | null;
  date_discovered: string;
  /** Solar-style pipeline status. */
  status: PipelineStatus;
  /** Legacy contact pipeline (synced from status). */
  contact_status: ContactStatus;
  score: number;
  category: LeadCategory | null;
  qualification_label: QualificationLabel;
  reasons: ScoreReason[];
  unknowns: string[];
  pipeline_version: string;
  last_analysed_at: string | null;
  raw_excerpt: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadAnalysis {
  id: string;
  lead_id: string;
  score: number;
  category: LeadCategory | null;
  qualification_label: QualificationLabel;
  ai_assessment: AiAssessment | null;
  reasons: ScoreReason[];
  unknowns: string[];
  pipeline_version: string;
  ran_at: string;
}

export interface DiscoveryProspect {
  id: string;
  title: string;
  location: string | null;
  source: string;
  source_kind: LeadSourceKind;
  source_url: string | null;
  external_id: string | null;
  snippet: string | null;
  raw_text: string | null;
  query: string | null;
  content_hash: string | null;
  preview_score: number | null;
  preview_assessment: AiAssessment | null;
  payload: Record<string, unknown>;
  imported_at: string | null;
  imported_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_TO_CONTACT: Record<PipelineStatus, ContactStatus> = {
  NEW: "Not contacted",
  CONTACTED: "Contacted",
  QUALIFIED: "Interested",
  PROPOSAL: "Under offer",
  NEGOTIATION: "Negotiating",
  WON: "Under offer",
  LOST: "Rejected",
};

export const CONTACT_TO_STATUS: Record<ContactStatus, PipelineStatus> = {
  "Not contacted": "NEW",
  Contacted: "CONTACTED",
  Interested: "QUALIFIED",
  Negotiating: "NEGOTIATION",
  "Under offer": "PROPOSAL",
  Rejected: "LOST",
};

export function displayUnknown(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") {
    return "Unknown";
  }
  return value;
}
