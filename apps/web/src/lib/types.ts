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

export type AiAssessment = "Strong" | "Investigate" | "Reject";

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

export interface Lead {
  id: string;
  ref: string;
  location: string;
  opportunity_type: OpportunityType;
  land_size: string | null;
  asking_price: number | null;
  planning_status: PlanningStatus;
  source: string;
  original_post_url: string | null;
  landowner_name: string | null;
  contact: string | null;
  ownership_confidence: OwnershipConfidence;
  seller_motivation: string | null;
  ai_assessment: AiAssessment;
  ai_rationale: string | null;
  date_discovered: string;
  contact_status: ContactStatus;
  raw_excerpt: string | null;
  created_at: string;
  updated_at: string;
}
