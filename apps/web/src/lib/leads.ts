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

export type LeadDataSource = "database" | "fixtures";

/** Short operator-facing DB failure text: code + message, no connection secrets. */
export function safeDbErrorMessage(err: unknown): string {
  const parts: string[] = [];
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    if (typeof e.code === "string" && e.code.trim()) parts.push(e.code.trim());
    if (typeof e.message === "string" && e.message.trim()) {
      parts.push(e.message.trim());
    }
  }
  let msg = parts.join(": ") || String(err);
  msg = msg
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/(password|pwd|pass)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{8,}:[^@\s/]{4,}@/g, "[redacted-userpass]@");
  if (msg.length > 240) msg = `${msg.slice(0, 237)}...`;
  return msg;
}

export async function fetchLeads(filters: LeadFilters = {}): Promise<{
  leads: Lead[];
  source: LeadDataSource;
  /** True when process.env.DATABASE_URL is present (server-only). */
  databaseConfigured: boolean;
  /** Set when DATABASE_URL exists but the query/connection failed. */
  dbError?: string;
}> {
  const databaseConfigured = Boolean(getPool());
  if (databaseConfigured) {
    try {
      const leads = await listLeads(filters);
      return { leads, source: "database", databaseConfigured };
    } catch (err) {
      // Fall through to fixtures if DB is unreachable / pre-migration.
      const dbError = safeDbErrorMessage(err);
      console.error(
        "[fetchLeads] DATABASE_URL set but Postgres query failed:",
        dbError,
      );
      let leads = await loadFixtureLeads();
      leads = applyFixtureFilters(leads, filters);
      return { leads, source: "fixtures", databaseConfigured, dbError };
    }
  }
  let leads = await loadFixtureLeads();
  leads = applyFixtureFilters(leads, filters);
  return { leads, source: "fixtures", databaseConfigured };
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

export async function fetchLead(id: string): Promise<{
  lead: Lead | null;
  source: LeadDataSource;
  databaseConfigured: boolean;
  dbError?: string;
}> {
  const databaseConfigured = Boolean(getPool());
  if (databaseConfigured) {
    try {
      const lead = await getLeadById(id);
      if (lead) return { lead, source: "database", databaseConfigured };
    } catch (err) {
      const dbError = safeDbErrorMessage(err);
      console.error(
        "[fetchLead] DATABASE_URL set but Postgres query failed:",
        dbError,
      );
      const lead = await loadFixtureLead(id);
      return { lead, source: "fixtures", databaseConfigured, dbError };
    }
  }
  const lead = await loadFixtureLead(id);
  return { lead, source: "fixtures", databaseConfigured };
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
