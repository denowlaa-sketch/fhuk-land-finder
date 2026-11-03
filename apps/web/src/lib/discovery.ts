import {
  getPool,
  importDiscoveryProspect,
  listDiscoveryProspects,
  upsertDiscoveryProspect,
} from "./db";
import { loadFixtureDiscoveryProspects } from "./fixtures";
import type { DiscoveryProspect, Lead } from "./types";

export async function fetchDiscoveryProspects(opts?: {
  pendingOnly?: boolean;
}): Promise<{
  prospects: DiscoveryProspect[];
  source: "database" | "fixtures";
}> {
  if (getPool()) {
    try {
      const prospects = await listDiscoveryProspects(opts);
      if (prospects.length > 0) {
        return { prospects, source: "database" };
      }
      // Empty DB: surface fixtures so Discovery is usable before collector write.
    } catch {
      // fall through
    }
  }
  let prospects = await loadFixtureDiscoveryProspects();
  if (opts?.pendingOnly !== false) {
    prospects = prospects.filter((p) => !p.imported_at);
  }
  return { prospects, source: "fixtures" };
}

export async function importProspect(id: string): Promise<{
  lead: Lead;
  created: boolean;
  duplicate: boolean;
  source: "database" | "fixtures";
} | null> {
  if (getPool()) {
    try {
      // If fixture-sourced id, materialise into discovery table then import.
      if (id.startsWith("fx-") || id.startsWith("sample-")) {
        const fixtures = await loadFixtureDiscoveryProspects();
        const fx = fixtures.find((p) => p.id === id);
        if (!fx) return null;
        const upserted = await upsertDiscoveryProspect({
          title: fx.title,
          location: fx.location,
          source: fx.source,
          source_kind: fx.source_kind,
          source_url: fx.source_url,
          external_id: fx.external_id,
          snippet: fx.snippet,
          raw_text: fx.raw_text,
          query: fx.query,
          content_hash: fx.content_hash,
          preview_score: fx.preview_score,
          preview_assessment: fx.preview_assessment ?? undefined,
          payload: fx.payload,
        });
        if (!upserted) return null;
        if (upserted.prospect.imported_lead_id) {
          const { getLeadById } = await import("./db");
          const existing = await getLeadById(upserted.prospect.imported_lead_id);
          if (existing) {
            return {
              lead: existing,
              created: false,
              duplicate: true,
              source: "database",
            };
          }
        }
        const result = await importDiscoveryProspect(upserted.prospect.id);
        if (!result) return null;
        return { ...result, source: "database" };
      }

      const result = await importDiscoveryProspect(id);
      if (!result) return null;
      return { ...result, source: "database" };
    } catch {
      return null;
    }
  }

  // Fixture-only mode: synthesise a lead shape without persistence.
  const fixtures = await loadFixtureDiscoveryProspects();
  const fx = fixtures.find((p) => p.id === id);
  if (!fx) return null;
  const { analyseLead } = await import("./scoring");
  const payload = fx.payload;
  const analysis = analyseLead({
    location: fx.location ?? "Unknown location",
    land_size: typeof payload.land_size === "string" ? payload.land_size : null,
    asking_price:
      typeof payload.asking_price === "number" ? payload.asking_price : null,
    planning_status:
      typeof payload.planning_status === "string"
        ? payload.planning_status
        : "unknown",
    landowner_name:
      typeof payload.landowner_name === "string" ? payload.landowner_name : null,
    contact: typeof payload.contact === "string" ? payload.contact : null,
    ownership_confidence:
      typeof payload.ownership_confidence === "string"
        ? payload.ownership_confidence
        : "unknown",
    seller_motivation:
      typeof payload.seller_motivation === "string"
        ? payload.seller_motivation
        : null,
    ai_assessment: fx.preview_assessment ?? "Investigate",
    source: fx.source,
    original_post_url: fx.source_url,
  });

  const now = new Date().toISOString();
  const lead: Lead = {
    id: `imported-${fx.id}`,
    ref: "FHUK-DEMO",
    location: fx.location ?? "Unknown location",
    opportunity_type:
      typeof payload.opportunity_type === "string"
        ? (payload.opportunity_type as Lead["opportunity_type"])
        : "other",
    land_size: typeof payload.land_size === "string" ? payload.land_size : null,
    asking_price:
      typeof payload.asking_price === "number" ? payload.asking_price : null,
    planning_status:
      typeof payload.planning_status === "string"
        ? (payload.planning_status as Lead["planning_status"])
        : "unknown",
    source: `discovery:${fx.source}`,
    source_kind: "AI_DISCOVERY",
    original_post_url: fx.source_url,
    landowner_name:
      typeof payload.landowner_name === "string" ? payload.landowner_name : null,
    contact: typeof payload.contact === "string" ? payload.contact : null,
    ownership_confidence:
      typeof payload.ownership_confidence === "string"
        ? (payload.ownership_confidence as Lead["ownership_confidence"])
        : "unknown",
    seller_motivation:
      typeof payload.seller_motivation === "string"
        ? payload.seller_motivation
        : null,
    ai_assessment: analysis.ai_assessment,
    ai_rationale: `Imported from discovery fixture (${fx.source})`,
    date_discovered: now,
    status: "NEW",
    contact_status: "Not contacted",
    score: analysis.score,
    category: analysis.category,
    qualification_label: analysis.qualification_label,
    reasons: analysis.reasons,
    unknowns: analysis.unknowns,
    pipeline_version: analysis.pipeline_version,
    last_analysed_at: now,
    raw_excerpt: fx.raw_text,
    created_at: now,
    updated_at: now,
  };
  return { lead, created: true, duplicate: false, source: "fixtures" };
}
