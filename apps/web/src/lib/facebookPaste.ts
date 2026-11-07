import { COVERAGE_TOWNS, titleCaseTown } from "./geography";
import { analyseLead } from "./scoring";
import type {
  AiAssessment,
  Lead,
  OpportunityType,
  OwnershipConfidence,
  PlanningStatus,
} from "./types";

export interface PasteAnalysis {
  location: string;
  opportunity_type: OpportunityType;
  land_size: string | null;
  asking_price: number | null;
  planning_status: PlanningStatus;
  landowner_name: string | null;
  contact: string | null;
  ownership_confidence: OwnershipConfidence;
  seller_motivation: string | null;
  ai_assessment: AiAssessment;
  ai_rationale: string;
  source: string;
  original_post_url: string | null;
  raw_excerpt: string;
}

export function isFacebookUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "fb.com" ||
      host.endsWith(".fb.com") ||
      host === "fb.watch"
    );
  } catch {
    return false;
  }
}

function voluntaryContact(raw: string): string | null {
  const email = raw.match(/\b[\w.+-]+@[\w.-]+\.\w+\b/);
  if (email) return email[0];
  const phone = raw.match(/\b(?:0|\+44)[\d\s-]{9,}\b/);
  if (phone) return phone[0].replace(/\s+/g, " ").trim();
  return null;
}

function heuristicLocation(raw: string): string {
  const pc = raw.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i);
  const lower = raw.toLowerCase();
  const town = COVERAGE_TOWNS.find((t) => lower.includes(t));
  if (town && pc) {
    return `${titleCaseTown(town)}, ${pc[1]!.toUpperCase()}`;
  }
  if (town) return titleCaseTown(town);
  if (pc) return pc[1]!.toUpperCase();
  return "Unknown UK";
}

/** Offline heuristic — mirrors collector fallback; never invents contacts. */
export function analyzePasteHeuristic(
  text: string,
  url?: string | null,
): PasteAnalysis {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  let ai_assessment: AiAssessment = "Investigate";
  let ownership_confidence: OwnershipConfidence = "possible";
  let ai_rationale =
    "Heuristic Facebook paste — URL not fetched; ownership/sale intent not assumed from the link alone.";

  const agentish = [
    "estate agency",
    "estates agency",
    "estate agent",
    "marketed by",
    "not a private landowner",
    "call the office",
  ].some((w) => lower.includes(w));

  if (agentish) {
    ai_assessment = "Reject";
    ownership_confidence = "unknown";
    ai_rationale =
      "Agent / marketed listing — Reject. URL not fetched; not treated as off-market landowner.";
  } else if (
    ["green belt", "not a building plot", "agricultural only"].some((w) =>
      lower.includes(w),
    )
  ) {
    ai_assessment = "Reject";
    ai_rationale = "Non-development / amenity-only signal. URL not fetched.";
  } else if (
    ["might sell", "not sure if", "rumour", "said their neighbour"].some((w) =>
      lower.includes(w),
    )
  ) {
    ai_assessment = "Investigate";
    ownership_confidence = "possible";
    ai_rationale =
      "Second-hand tip — ownership and sale intent not assumed. URL not fetched.";
  } else if (
    ["selling", "for sale", "private sale", "outline planning", "guide £"].some(
      (w) => lower.includes(w),
    ) &&
    ["garden", "plot", "yard", "land", "backland"].some((w) =>
      lower.includes(w),
    )
  ) {
    ai_assessment = "Strong";
    ownership_confidence = [
      "we own",
      "family-owned",
      "private sale",
      "our house",
    ].some((w) => lower.includes(w))
      ? "likely"
      : "possible";
    ai_rationale =
      "Sale intent + land/plot language in pasted text. URL not fetched.";
  }

  let opportunity_type: OpportunityType = "other";
  const oppPairs: Array<[string, OpportunityType]> = [
    ["brownfield", "brownfield"],
    ["back", "backland"],
    ["garden", "garden_plot"],
    ["infill", "infill"],
    ["paddock", "agricultural"],
    ["agricultural", "agricultural"],
  ];
  for (const [key, label] of oppPairs) {
    if (lower.includes(key)) {
      opportunity_type = label;
      break;
    }
  }

  const priceMatch = raw.match(/£\s?([\d,]+)/);
  const asking_price = priceMatch
    ? Number(priceMatch[1]!.replace(/,/g, ""))
    : null;

  let planning_status: PlanningStatus = "unknown";
  if (lower.includes("outline")) planning_status = "outline";
  else if (lower.includes("no planning") || lower.includes("no current planning"))
    planning_status = "none";

  const nameMatch = raw.trim().match(/[—\-–]\s*([A-Z][a-z]+)\s*$/);
  const landowner_name =
    nameMatch && ai_assessment !== "Reject" ? nameMatch[1]! : null;

  const cleanedUrl = url?.trim() || null;
  const source =
    cleanedUrl && isFacebookUrl(cleanedUrl) ? "facebook_paste" : "manual_paste";

  return {
    location: heuristicLocation(raw),
    opportunity_type,
    land_size: null,
    asking_price,
    planning_status,
    landowner_name,
    contact: voluntaryContact(raw),
    ownership_confidence,
    seller_motivation: null,
    ai_assessment,
    ai_rationale,
    source: cleanedUrl ? source : "facebook_paste",
    original_post_url: cleanedUrl,
    raw_excerpt: raw,
  };
}

const OPENAI_SCHEMA_HINT = `JSON keys:
- location (string)
- opportunity_type: backland|garden_plot|brownfield|infill|agricultural|other
- land_size (string|null)
- asking_price (number|null, GBP)
- planning_status: none|pre_app|outline|full|expired|unknown
- landowner_name (string|null)
- contact (string|null)
- ownership_confidence: confirmed|likely|possible|unknown
- seller_motivation (string|null)
- ai_assessment: Strong|Investigate|Reject
- ai_rationale (string, short)`;

export async function analyzePasteWithOpenAI(
  text: string,
  url?: string | null,
): Promise<PasteAnalysis | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a land-sourcing analyst for Flipping Homes UK. The user pasted a Facebook post URL and/or text. The URL was NOT fetched. Extract fields only from pasted text. Do not invent contacts. Do not assume ownership or sale intent. Rumour → Investigate. Agent ads → Reject. JSON only.",
        },
        {
          role: "user",
          content: `Source: user Facebook paste (no scrape).\nURL (metadata only): ${url || "(none)"}\n\nPasted text:\n${text}\n\nReturn JSON matching:\n${OPENAI_SCHEMA_HINT}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const base = analyzePasteHeuristic(text, url);
  const assessments: AiAssessment[] = ["Strong", "Investigate", "Reject"];
  const owns: OwnershipConfidence[] = [
    "confirmed",
    "likely",
    "possible",
    "unknown",
  ];

  return {
    ...base,
    location: String(data.location || base.location),
    opportunity_type: (data.opportunity_type as OpportunityType) || base.opportunity_type,
    land_size:
      data.land_size === null || data.land_size === undefined
        ? null
        : String(data.land_size),
    asking_price:
      typeof data.asking_price === "number"
        ? data.asking_price
        : base.asking_price,
    planning_status:
      (data.planning_status as PlanningStatus) || base.planning_status,
    landowner_name:
      data.landowner_name === null || data.landowner_name === undefined
        ? null
        : String(data.landowner_name),
    contact:
      data.contact === null || data.contact === undefined
        ? null
        : String(data.contact),
    ownership_confidence: owns.includes(
      data.ownership_confidence as OwnershipConfidence,
    )
      ? (data.ownership_confidence as OwnershipConfidence)
      : base.ownership_confidence,
    seller_motivation:
      data.seller_motivation === null || data.seller_motivation === undefined
        ? null
        : String(data.seller_motivation),
    ai_assessment: assessments.includes(data.ai_assessment as AiAssessment)
      ? (data.ai_assessment as AiAssessment)
      : base.ai_assessment,
    ai_rationale: `${String(data.ai_rationale || base.ai_rationale)} (Facebook paste — URL not fetched.)`,
  };
}

export async function analyzePaste(
  text: string,
  url?: string | null,
): Promise<PasteAnalysis> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      "Paste the public post text to analyse. This tool does not fetch or scrape Facebook URLs.",
    );
  }
  const openai = await analyzePasteWithOpenAI(trimmed, url);
  return openai ?? analyzePasteHeuristic(trimmed, url);
}

export function analysisToPreviewLead(analysis: PasteAnalysis): Lead {
  const now = new Date().toISOString();
  const scored = analyseLead(analysis);
  return {
    id: "preview",
    ref: "FHUK-PREVIEW",
    location: analysis.location,
    opportunity_type: analysis.opportunity_type,
    land_size: analysis.land_size,
    asking_price: analysis.asking_price,
    planning_status: analysis.planning_status,
    source: analysis.source,
    source_kind: "FACEBOOK_URL",
    original_post_url: analysis.original_post_url,
    landowner_name: analysis.landowner_name,
    contact: analysis.contact,
    ownership_confidence: analysis.ownership_confidence,
    seller_motivation: analysis.seller_motivation,
    ai_assessment: analysis.ai_assessment,
    ai_rationale: analysis.ai_rationale,
    date_discovered: now,
    status: "NEW",
    contact_status: "Not contacted",
    score: scored.score,
    category: scored.category,
    qualification_label: scored.qualification_label,
    reasons: scored.reasons,
    unknowns: scored.unknowns,
    pipeline_version: scored.pipeline_version,
    last_analysed_at: now,
    raw_excerpt: analysis.raw_excerpt,
    created_at: now,
    updated_at: now,
  };
}
