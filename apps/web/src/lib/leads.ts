import { getPool, getLeadById, listLeads, updateContactStatus } from "./db";
import { loadFixtureLead, loadFixtureLeads } from "./fixtures";
import type { ContactStatus, Lead } from "./types";

export async function fetchLeads(): Promise<{
  leads: Lead[];
  source: "database" | "fixtures";
}> {
  if (getPool()) {
    try {
      const leads = await listLeads();
      return { leads, source: "database" };
    } catch {
      // Fall through to fixtures if DB is unreachable.
    }
  }
  return { leads: await loadFixtureLeads(), source: "fixtures" };
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

export async function setLeadStatus(
  id: string,
  status: ContactStatus,
): Promise<Lead | null> {
  if (!getPool()) return null;
  return updateContactStatus(id, status);
}
