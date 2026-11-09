import type { LeadSourceKind } from "@/lib/types";

/** Paid Instant Form / Lead Gen sources eligible for PECR consent-gated calls. */
export const AD_CALL_SOURCES: readonly LeadSourceKind[] = [
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
] as const;

export type AdChannel = "facebook" | "instagram" | "tiktok";

export const AD_CHANNEL_LABELS: Record<AdChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export function isAdCallSource(
  source: string | null | undefined,
): source is LeadSourceKind {
  return (
    source === "FACEBOOK" || source === "INSTAGRAM" || source === "TIKTOK"
  );
}

export function sourceKindToAdChannel(
  source: LeadSourceKind | string | null | undefined,
): AdChannel | null {
  if (source === "FACEBOOK") return "facebook";
  if (source === "INSTAGRAM") return "instagram";
  if (source === "TIKTOK") return "tiktok";
  return null;
}

export function adChannelToSourceKind(channel: AdChannel): LeadSourceKind {
  if (channel === "instagram") return "INSTAGRAM";
  if (channel === "tiktok") return "TIKTOK";
  return "FACEBOOK";
}

/**
 * Detect Meta channel from Instant Form field map or webhook hints.
 * FB + IG share the same leadgen webhook — default facebook when unknown.
 */
export function detectMetaAdChannel(opts: {
  fieldData?:
    | Array<{ name?: string; values?: string[] } | Record<string, unknown>>
    | Record<string, string>
    | null;
  hint?: string | null;
}): AdChannel {
  const hint = (opts.hint || "").toLowerCase();
  if (hint.includes("instagram") || hint === "ig" || hint === "instagram") {
    return "instagram";
  }
  if (hint.includes("facebook") || hint === "fb" || hint === "facebook") {
    return "facebook";
  }

  const raw: Record<string, string> = {};
  const fields = opts.fieldData;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const name =
        "name" in field && typeof field.name === "string"
          ? field.name.trim().toLowerCase()
          : "";
      if (!name) continue;
      let value = "";
      if (
        "values" in field &&
        Array.isArray(field.values) &&
        field.values[0] != null
      ) {
        value = String(field.values[0]).trim();
      } else if ("value" in field && field.value != null) {
        value = String(field.value).trim();
      }
      raw[name] = value;
    }
  } else if (fields && typeof fields === "object") {
    for (const [k, v] of Object.entries(fields)) {
      raw[k.toLowerCase()] = String(v ?? "").trim();
    }
  }

  const platform = (
    raw.platform ||
    raw.ad_platform ||
    raw.channel ||
    raw.source_platform ||
    raw.meta_platform ||
    ""
  ).toLowerCase();
  if (platform.includes("instagram") || platform === "ig") return "instagram";
  return "facebook";
}

/** SQL IN-list fragment for ad call sources (safe — fixed enum literals). */
export const AD_CALL_SOURCES_SQL = `('FACEBOOK'::lead_source, 'INSTAGRAM'::lead_source, 'TIKTOK'::lead_source)`;
