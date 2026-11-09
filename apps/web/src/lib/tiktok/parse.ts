import { parseFacebookLandForm } from "@/lib/facebook/parse";
import type { FacebookLandFormAnswers } from "@/lib/facebook/types";

/**
 * TikTok Lead Gen field maps vary by form — reuse land Instant Form aliases.
 * Accepts TikTok-style { name, value } or Meta-style { name, values[] }.
 */
export function parseTikTokLandForm(
  fields:
    | Array<{ name?: string; values?: string[]; value?: string } | Record<string, unknown>>
    | Record<string, string>,
): FacebookLandFormAnswers {
  if (Array.isArray(fields)) {
    const normalized = fields.map((field) => {
      if (!field || typeof field !== "object") return { name: "", values: [] };
      const name =
        "name" in field && typeof field.name === "string" ? field.name : "";
      if ("values" in field && Array.isArray(field.values)) {
        return { name, values: field.values.map(String) };
      }
      if ("value" in field && field.value != null) {
        return { name, values: [String(field.value)] };
      }
      return { name, values: [] };
    });
    return parseFacebookLandForm(normalized);
  }
  return parseFacebookLandForm(fields);
}
