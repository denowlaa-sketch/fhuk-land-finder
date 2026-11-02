import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type {
  AiAssessment,
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

/** Load hypothetical fixture leads when DATABASE_URL is unset (local demo). */
export async function loadFixtureLeads(): Promise<Lead[]> {
  const dir = fixturesDir();
  let files: string[];
  try {
    files = (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .sort();
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
    leads.push({
      id: fx.id,
      ref,
      location: fx.expected.location,
      opportunity_type: fx.expected.opportunity_type,
      land_size: fx.expected.land_size,
      asking_price: fx.expected.asking_price,
      planning_status: fx.expected.planning_status,
      source: fx.source,
      original_post_url: fx.original_post_url,
      landowner_name: fx.expected.landowner_name,
      contact: fx.expected.contact,
      ownership_confidence: fx.expected.ownership_confidence,
      seller_motivation: fx.expected.seller_motivation,
      ai_assessment: fx.expected.ai_assessment,
      ai_rationale: `Fixture expected assessment for ${fx.title}`,
      date_discovered: fx.posted_at,
      contact_status: "Not contacted",
      raw_excerpt: fx.raw_text,
      created_at: fx.posted_at,
      updated_at: fx.posted_at,
    });
  }
  return leads;
}

export async function loadFixtureLead(idOrRef: string): Promise<Lead | null> {
  const leads = await loadFixtureLeads();
  return (
    leads.find((l) => l.id === idOrRef || l.ref === idOrRef) ?? null
  );
}
