/** Facebook Instant Form field labels for UK land seller intake. */

export type LandTenure = "freehold" | "leasehold" | "unknown";

export type LandTimeline =
  | "asap"
  | "within_3_months"
  | "within_6_months"
  | "exploring"
  | "unknown";

export type PlanningSignal =
  | "none"
  | "pre_app"
  | "outline"
  | "full"
  | "expired"
  | "unknown";

export interface FacebookLandFormAnswers {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  plotSize: string | null;
  tenure: LandTenure;
  planning: PlanningSignal;
  priceExpectation: string | null;
  timeline: LandTimeline;
  /** Why they may sell / option — land ICP (not solar bill/roof). */
  motivation: string | null;
  ownershipInterest: boolean | null;
  consentToCall: boolean;
  /** Raw Instant Form field map for audit. */
  raw: Record<string, string>;
}

export interface FacebookLeadgenEntry {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  created_time?: number | string;
  ad_id?: string;
  adgroup_id?: string;
}

export const TENURE_LABELS: Record<LandTenure, string> = {
  freehold: "Freehold",
  leasehold: "Leasehold",
  unknown: "Unknown",
};

export const TIMELINE_LABELS: Record<LandTimeline, string> = {
  asap: "ASAP",
  within_3_months: "Within 3 months",
  within_6_months: "Within 6 months",
  exploring: "Just exploring",
  unknown: "Unknown",
};

export const PLANNING_LABELS: Record<PlanningSignal, string> = {
  none: "No planning",
  pre_app: "Pre-app",
  outline: "Outline",
  full: "Full permission",
  expired: "Expired",
  unknown: "Unknown",
};
