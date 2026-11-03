import {
  analyseAllLeads,
  analyseLeadById,
  getLeadById,
  getPool,
  listLeadAnalyses,
  listLeads,
  updateLeadStatus,
  type LeadFilters,
} from "./db";
import { analyseLead } from "./scoring";
import { loadFixtureLead, loadFixtureLeads } from "./fixtures";
import type { Lead, LeadAnalysis, PipelineStatus } from "./types";

export async function fetchLeads(filters: LeadFilters = {}): Promise<{
  leads: Lead[];
  source: "database" | "fixtures";
}> {
  if (getPool()) {
    try {
      const leads = await listLeads(filters);
      return { leads, source: "database" };
    } catch {
      // Fall through to fixtures if DB is unreachable / pre-migration.
    }
  }
  let leads = await loadFixtureLeads();
  leads = applyFixtureFilters(leads, filters);
  return { leads, source: "fixtures" };
}

function applyFixtureFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  return leads.filter((lead) => {
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.category && lead.category !== filters.category) return false;
    if (
      filters.qualification &&
      lead.qualification_label !== filters.qualification
    ) {
      return false;
    }
    if (
      filters.minScore != null &&
      !Number.isNaN(filters.minScore) &&
      lead.score < filters.minScore
    ) {
      return false;
    }
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      const hay = [
        lead.location,
        lead.ref,
        lead.source,
        lead.landowner_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function fetchLead(
  id: string,
): Promise<{ lead: Lead | null; source: "database" | "fixtures" }> {
  if (getPool()) {
    try {
      const lead = await getLeadById(id);
      if (lead) return { lead, source: "database" };
    } catch {
      // Fall through.
    }
  }
  const lead = await loadFixtureLead(id);
  return { lead, source: "fixtures" };
}

export async function fetchLeadAnalyses(
  leadId: string,
  source: "database" | "fixtures",
  lead: Lead | null,
): Promise<LeadAnalysis[]> {
  if (source === "database") {
    try {
      return await listLeadAnalyses(leadId);
    } catch {
      // fall through
    }
  }
  if (!lead) return [];
  return [
    {
      id: `fx-analysis-${lead.id}`,
      lead_id: lead.id,
      score: lead.score,
      category: lead.category,
      qualification_label: lead.qualification_label,
      ai_assessment: lead.ai_assessment,
      reasons: lead.reasons,
      unknowns: lead.unknowns,
      pipeline_version: lead.pipeline_version,
      ran_at: lead.last_analysed_at ?? lead.updated_at,
    },
  ];
}

export async function setLeadStatus(
  id: string,
  status: PipelineStatus,
): Promise<Lead | null> {
  if (!getPool()) return null;
  return updateLeadStatus(id, status);
}

export async function reanalyseLead(id: string): Promise<Lead | null> {
  if (!getPool()) {
    const lead = await loadFixtureLead(id);
    if (!lead) return null;
    const analysis = analyseLead(lead);
    return { ...lead, ...analysis, last_analysed_at: new Date().toISOString() };
  }
  return analyseLeadById(id);
}

export async function reanalyseAll(): Promise<{ count: number }> {
  if (!getPool()) {
    const leads = await loadFixtureLeads();
    return { count: leads.length };
  }
  const result = await analyseAllLeads();
  return { count: result.count };
}
