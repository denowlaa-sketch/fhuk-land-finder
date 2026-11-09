import type {
  FacebookLandFormAnswers,
  LandTenure,
  LandTimeline,
  PlanningSignal,
} from "./types";

function fieldMap(
  fields: Array<{ name?: string; values?: string[] } | Record<string, unknown>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    if (!field || typeof field !== "object") continue;
    const name =
      "name" in field && typeof field.name === "string"
        ? field.name.trim().toLowerCase()
        : "";
    if (!name) continue;
    let value = "";
    if ("values" in field && Array.isArray(field.values) && field.values[0] != null) {
      value = String(field.values[0]).trim();
    } else if ("value" in field && field.value != null) {
      value = String(field.value).trim();
    }
    out[name] = value;
  }
  return out;
}

function pick(raw: Record<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (raw[key]?.trim()) return raw[key].trim();
  }
  // fuzzy: any key containing the alias token
  for (const alias of aliases) {
    const token = alias.toLowerCase().replace(/_/g, "");
    for (const [k, v] of Object.entries(raw)) {
      if (k.replace(/_/g, "").includes(token) && v.trim()) return v.trim();
    }
  }
  return null;
}

/** PECR: explicit yes only — unknowns / empty are not consent. */
export function parseYesNo(value: string | null | undefined): boolean | null {
  if (value == null || !String(value).trim()) return null;
  const v = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1", "agree", "i agree", "consent", "ok"].includes(v)) {
    return true;
  }
  if (["no", "n", "false", "0", "disagree", "decline"].includes(v)) {
    return false;
  }
  if (v.includes("yes") || v.includes("agree") || v.includes("consent")) return true;
  if (v.includes("no") || v.includes("decline")) return false;
  return null;
}

function parseTenure(value: string | null): LandTenure {
  if (!value) return "unknown";
  const v = value.toLowerCase();
  if (v.includes("free")) return "freehold";
  if (v.includes("lease")) return "leasehold";
  return "unknown";
}

function parseTimeline(value: string | null): LandTimeline {
  if (!value) return "unknown";
  const v = value.toLowerCase();
  if (v.includes("asap") || v.includes("immediate") || v.includes("now")) {
    return "asap";
  }
  if (v.includes("3") || v.includes("three")) return "within_3_months";
  if (v.includes("6") || v.includes("six")) return "within_6_months";
  if (v.includes("explor") || v.includes("later") || v.includes("unsure")) {
    return "exploring";
  }
  return "unknown";
}

function parsePlanning(value: string | null): PlanningSignal {
  if (!value) return "unknown";
  const v = value.toLowerCase();
  if (v.includes("none") || v.includes("no planning") || v.includes("without")) {
    return "none";
  }
  if (v.includes("pre")) return "pre_app";
  if (v.includes("outline")) return "outline";
  if (v.includes("full") || v.includes("detailed")) return "full";
  if (v.includes("expir")) return "expired";
  return "unknown";
}

/**
 * Map Meta Instant Form field_data (or simulate body) onto land seller answers.
 * Consent aliases mirror solar: consent_to_call, may_we_call_you, etc.
 */
export function parseFacebookLandForm(
  fields:
    | Array<{ name?: string; values?: string[] } | Record<string, unknown>>
    | Record<string, string>,
): FacebookLandFormAnswers {
  const raw = Array.isArray(fields)
    ? fieldMap(fields)
    : Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k.toLowerCase(), String(v ?? "").trim()]),
      );

  const consentRaw = pick(raw, [
    "consent_to_call",
    "consent_to_contact",
    "may_we_call_you",
    "phone_consent",
    "call_consent",
    "you_may_call_me",
    "contact_consent",
  ]);
  const consentParsed = parseYesNo(consentRaw);

  const ownershipRaw = pick(raw, [
    "ownership_interest",
    "are_you_the_owner",
    "owner",
    "landowner",
    "do_you_own_the_land",
  ]);

  return {
    fullName: pick(raw, [
      "full_name",
      "full name",
      "name",
      "first_name",
      "contact_name",
    ]),
    phone: pick(raw, [
      "phone_number",
      "phone",
      "mobile",
      "mobile_number",
      "tel",
      "contact_phone",
    ]),
    email: pick(raw, ["email", "email_address", "contact_email"]),
    location: pick(raw, [
      "location",
      "town",
      "city",
      "postcode",
      "address",
      "plot_location",
      "where_is_the_land",
    ]),
    plotSize: pick(raw, [
      "plot_size",
      "land_size",
      "size",
      "acreage",
      "acres",
      "how_big",
    ]),
    tenure: parseTenure(pick(raw, ["tenure", "title", "freehold_leasehold"])),
    planning: parsePlanning(
      pick(raw, ["planning", "planning_status", "planning_permission"]),
    ),
    priceExpectation: pick(raw, [
      "price_expectation",
      "asking_price",
      "price",
      "guide_price",
      "how_much",
    ]),
    timeline: parseTimeline(
      pick(raw, ["timeline", "when", "timescale", "urgency"]),
    ),
    motivation: pick(raw, [
      "motivation",
      "seller_motivation",
      "why_selling",
      "reason_for_sale",
      "why_are_you_selling",
      "reason",
    ]),
    ownershipInterest: parseYesNo(ownershipRaw),
    // PECR: only true when explicitly yes
    consentToCall: consentParsed === true,
    raw,
  };
}
