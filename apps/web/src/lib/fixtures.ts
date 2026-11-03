import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { analyseLead } from "./scoring";
import type {
  AiAssessment,
  DiscoveryProspect,
  Lead,
  OpportunityType,
  OwnershipConfidence,
  PlanningStatus,
} from "./types";

interface FixtureFile {
  id: string;
  town: string;
  title: string;
  source: string;
  original_post_url: string;
  posted_at: string;
  raw_text: string;
  expected: {
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
  };
}

/** Resolve repo-root fixtures from apps/web cwd, monorepo root, or traced Vercel bundle. */
function fixturesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../fixtures"),
    path.resolve(process.cwd(), "fixtures"),
    path.resolve(__dirname, "../../../../fixtures"),
    path.resolve(__dirname, "../../../fixtures"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

function samplesDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../services/collector/samples/search"),
    path.resolve(process.cwd(), "services/collector/samples/search"),
    path.resolve(__dirname, "../../../../services/collector/samples/search"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0]!;
}

/** Load hypothetical fixture leads when DATABASE_URL is unset (local demo). */
export async function loadFixtureLeads(): Promise<Lead[]> {
  const dir = fixturesDir();
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }

  const leads: Lead[] = [];
  let n = 1;
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const fx = JSON.parse(raw) as FixtureFile;
    const ref = `FHUK-${String(n).padStart(4, "0")}`;
    n += 1;
    const base = {
      location: fx.expected.location,
      opportunity_type: fx.expected.opportunity_type,
      land_size: fx.expected.land_size,
      asking_price: fx.expected.asking_price,
      planning_status: fx.expected.planning_status,
      landowner_name: fx.expected.landowner_name,
      contact: fx.expected.contact,
      ownership_confidence: fx.expected.ownership_confidence,
      seller_motivation: fx.expected.seller_motivation,
      ai_assessment: fx.expected.ai_assessment,
      ai_rationale: `Fixture expected assessment for ${fx.title}`,
      source: fx.source,
      original_post_url: fx.original_post_url,
    };
    const analysis = analyseLead(base);
    leads.push({
      id: fx.id,
      ref,
      ...base,
      source_kind: "FIXTURE",
      date_discovered: fx.posted_at,
      status: "NEW",
      contact_status: "Not contacted",
      score: analysis.score,
      category: analysis.category,
      qualification_label: analysis.qualification_label,
      reasons: analysis.reasons,
      unknowns: analysis.unknowns,
      pipeline_version: analysis.pipeline_version,
      last_analysed_at: fx.posted_at,
      raw_excerpt: fx.raw_text,
      created_at: fx.posted_at,
      updated_at: fx.posted_at,
    });
  }
  return leads;
}

export async function loadFixtureLead(idOrRef: string): Promise<Lead | null> {
  const leads = await loadFixtureLeads();
  return leads.find((l) => l.id === idOrRef || l.ref === idOrRef) ?? null;
}

/** Collector sample hits + fixture posts as discovery inbox when DB empty. */
export async function loadFixtureDiscoveryProspects(): Promise<
  DiscoveryProspect[]
> {
  const prospects: DiscoveryProspect[] = [];
  const now = new Date().toISOString();

  // Full fixture posts as pending discovery items.
  try {
    const dir = fixturesDir();
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const raw = await readFile(path.join(dir, file), "utf8");
      const fx = JSON.parse(raw) as FixtureFile;
      const analysis = analyseLead({
        ...fx.expected,
        source: fx.source,
        original_post_url: fx.original_post_url,
        ai_rationale: fx.title,
      });
      prospects.push({
        id: `fx-${fx.id}`,
        title: fx.title,
        location: fx.expected.location,
        source: fx.source,
        source_kind: "FIXTURE",
        source_url: fx.original_post_url,
        external_id: fx.id,
        snippet: fx.raw_text.slice(0, 220),
        raw_text: fx.raw_text,
        query: null,
        content_hash: null,
        preview_score: analysis.score,
        preview_assessment: fx.expected.ai_assessment,
        payload: { ...fx.expected, ai_rationale: `Fixture: ${fx.title}` },
        imported_at: null,
        imported_lead_id: null,
        created_at: fx.posted_at,
        updated_at: fx.posted_at,
      });
    }
  } catch {
    // ignore
  }

  // Recorded search samples (title/url/snippet only — unknowns honest).
  try {
    const dir = samplesDir();
    const files = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .sort();
    let i = 0;
    for (const file of files) {
      const raw = await readFile(path.join(dir, file), "utf8");
      const data = JSON.parse(raw) as {
        items?: Array<{
          title?: string;
          link?: string;
          url?: string;
          snippet?: string;
          displayLink?: string;
        }>;
        results?: Array<{
          title?: string;
          url?: string;
          link?: string;
          snippet?: string;
        }>;
      };
      const items = data.items ?? data.results ?? [];
      for (const item of items.slice(0, 4)) {
        i += 1;
        const url = item.link ?? item.url ?? null;
        const title = item.title ?? `Sample hit ${i}`;
        prospects.push({
          id: `sample-${file}-${i}`,
          title,
          location: null,
          source: file.replace(/\.json$/, ""),
          source_kind: "SEARCH",
          source_url: url,
          external_id: url,
          snippet: item.snippet ?? null,
          raw_text: item.snippet ?? null,
          query: null,
          content_hash: null,
          preview_score: null,
          preview_assessment: null,
          payload: {},
          imported_at: null,
          imported_lead_id: null,
          created_at: now,
          updated_at: now,
        });
      }
    }
  } catch {
    // ignore
  }

  return prospects;
}
