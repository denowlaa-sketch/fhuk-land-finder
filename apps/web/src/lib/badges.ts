import type {
  AiAssessment,
  LeadCategory,
  PipelineStatus,
  QualificationLabel,
} from "./types";

export function statusBadgeClass(status: PipelineStatus): string {
  const map: Record<PipelineStatus, string> = {
    NEW: "bg-sky-50 text-sky-800 ring-sky-200",
    CONTACTED: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    QUALIFIED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    PROPOSAL: "bg-violet-50 text-violet-800 ring-violet-200",
    NEGOTIATION: "bg-amber-50 text-amber-900 ring-amber-200",
    WON: "bg-green-100 text-green-900 ring-green-300",
    LOST: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return map[status];
}

export function categoryBadgeClass(category: LeadCategory | null): string {
  if (!category) return "bg-slate-50 text-slate-500 ring-slate-200";
  const map: Record<LeadCategory, string> = {
    A: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    B: "bg-lime-50 text-lime-800 ring-lime-200",
    C: "bg-amber-50 text-amber-900 ring-amber-200",
    D: "bg-rose-50 text-rose-800 ring-rose-200",
  };
  return map[category];
}

export function qualificationBadgeClass(label: QualificationLabel): string {
  const map: Record<QualificationLabel, string> = {
    EXCELLENT: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    GOOD: "bg-teal-50 text-teal-800 ring-teal-200",
    REVIEW: "bg-amber-50 text-amber-900 ring-amber-200",
    UNSUITABLE: "bg-rose-50 text-rose-800 ring-rose-200",
    NOT_ANALYSED: "bg-slate-50 text-slate-500 ring-slate-200",
  };
  return map[label];
}

export function assessmentBadgeClass(assessment: AiAssessment): string {
  const map: Record<AiAssessment, string> = {
    Strong: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Investigate: "bg-amber-50 text-amber-900 ring-amber-200",
    Reject: "bg-rose-50 text-rose-800 ring-rose-200",
  };
  return map[assessment];
}

export function scoreBucket(score: number): string {
  if (score >= 80) return "80–100";
  if (score >= 60) return "60–79";
  if (score >= 40) return "40–59";
  return "0–39";
}
