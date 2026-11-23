import { isHouseType, houseTypeLabel } from "./quoteView";
import { RETRIEVED_ON } from "./scenarios";
import {
  describeCouncil,
  type CilDocument,
  type Citation,
  type HousingSiteHit,
} from "./councilNotes";

export interface Sale {
  address: string;
  postcode: string;
  price: number;
  date: string;
  type: string;
  onThisAddress: boolean;
}

export interface PostcodeLookup {
  postcode: string;
  retrievedOn: string;
  sector: string;
  latitude: number;
  longitude: number;
  authorityName: string;
  gss: string | null;
  lpaName: string | null;
  parish: string | null;
  ward: string | null;
  builtUpArea: string | null;
  country: string | null;
  website: string | null;
  address: string;
  houseType: string;
  unitPrice: number | null;
  sales: Sale[];
  salesError: string | null;
  cilRatePerM2: number | null;
  cilSummary: string;
  s106Amount: number | null;
  s106Summary: string;
  onPublishedSite: boolean;
  siteSummary: string;
  buildSummary: string;
  citations: Citation[];
}

interface PlanningEntity {
  entity?: number;
  name?: string;
  dataset?: string;
  reference?: string;
  "organisation-entity"?: number;
  "statistical-geography"?: string;
  website?: string;
  "document-url"?: string;
  "documentation-url"?: string;
  "adopted-date"?: string;
}

const PLANNING = "https://www.planning.data.gov.uk/entity.json";
const USER_AGENT = "fhuk-land-finder";
const HOUSING_DATASETS = new Set(["brownfield-land", "brownfield-site", "site"]);

let authorityCache: Map<string, PlanningEntity> | null = null;
let cilCache: PlanningEntity[] | null = null;

export function normalizePostcode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

export function postcodeSector(postcode: string): string {
  const [outward, inward] = postcode.split(" ");
  return `${outward} ${inward.slice(0, 1)}`;
}

async function getJson(url: string, timeoutMs = 20000): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${url}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json();
}

async function loadAuthorities(): Promise<Map<string, PlanningEntity>> {
  if (authorityCache) return authorityCache;
  const payload = (await getJson(`${PLANNING}?dataset=local-authority&limit=500`)) as {
    entities?: PlanningEntity[];
  };
  const map = new Map<string, PlanningEntity>();
  for (const entity of payload.entities ?? []) {
    const code = entity["statistical-geography"];
    if (code) map.set(code, entity);
  }
  authorityCache = map;
  return map;
}

async function loadCilSchedules(): Promise<PlanningEntity[]> {
  if (cilCache) return cilCache;
  const payload = (await getJson(
    `${PLANNING}?dataset=community-infrastructure-levy-schedule&limit=300`,
  )) as { entities?: PlanningEntity[] };
  cilCache = payload.entities ?? [];
  return cilCache;
}

async function planningSearch(params: Record<string, string>): Promise<PlanningEntity[]> {
  const url = new URL(PLANNING);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const payload = (await getJson(url.toString())) as { entities?: PlanningEntity[] };
  return payload.entities ?? [];
}

function average(sales: Sale[]): number | null {
  if (sales.length === 0) return null;
  return sales.reduce((sum, sale) => sum + sale.price, 0) / sales.length;
}

async function sampleAround(postcode: string, latitude: number, longitude: number): Promise<string[]> {
  const geolocations = [];
  for (const radius of [1000, 3000]) {
    for (let bearing = 0; bearing < 360; bearing += 45) {
      const radians = (bearing * Math.PI) / 180;
      const dLat = (radius / 111320) * Math.cos(radians);
      const dLng = (radius / (111320 * Math.cos((latitude * Math.PI) / 180))) * Math.sin(radians);
      geolocations.push({
        longitude: longitude + dLng,
        latitude: latitude + dLat,
        radius: 400,
        limit: 1,
      });
    }
  }
  const codes = new Set<string>([postcode]);
  try {
    const response = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ geolocations }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [...codes];
    const payload = (await response.json()) as {
      result?: { result?: { postcode?: string }[] }[];
    };
    for (const item of payload.result ?? []) {
      const code = normalizePostcode(item.result?.[0]?.postcode ?? "");
      if (code) codes.add(code);
    }
  } catch {
    return [...codes];
  }
  return [...codes];
}

function typeFilter(houseType: string): string {
  if (houseType === "flat-maisonette") return 'FILTER(CONTAINS(LCASE(STR(?ptype)), "flat"))';
  return `FILTER(STR(?ptype) = "${houseType}")`;
}

function salesQuery(postcodes: string[], houseType: string): string {
  const branches = postcodes
    .map(
      (code) => `{
    ?addr lrcommon:postcode "${code}" .
    BIND("${code}" AS ?postcode)
  }`,
    )
    .join(" UNION ");
  return `
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?paon ?street ?postcode ?amount ?date ?ptype ?category WHERE {
  ${branches}
  ?transx lrppi:propertyAddress ?addr ;
          lrppi:pricePaid ?amount ;
          lrppi:transactionDate ?date ;
          lrppi:propertyType/skos:prefLabel ?ptype .
  OPTIONAL { ?transx lrppi:transactionCategory/skos:prefLabel ?category }
  FILTER(?date >= "2023-01-01"^^xsd:date)
  ${typeFilter(houseType)}
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:street ?street }
} LIMIT 80
`;
}

function onThisAddress(saleAddress: string, typed: string): boolean {
  const street = saleAddress.replace(/^[0-9A-Z]+\s+/i, "").trim().toUpperCase();
  const paon = saleAddress.split(" ")[0]?.toUpperCase() ?? "";
  const haystack = typed.toUpperCase();
  if (street.length < 4 || !haystack.includes(street)) return false;
  if (!paon) return false;
  return new RegExp(`(^|\\s)${paon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(haystack);
}

async function runSalesQuery(
  query: string,
  houseType: string,
  address: string,
): Promise<{ sales: Sale[]; error: string | null }> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://landregistry.data.gov.uk/landregistry/query", {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(35000),
    });
    lastStatus = response.status;
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      return { sales: [], error: `Land Registry returned HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as {
      results?: { bindings?: Record<string, { value: string }>[] };
    };
    const sales: Sale[] = [];
    for (const row of payload.results?.bindings ?? []) {
      const type = row.ptype?.value ?? houseType;
      const category = (row.category?.value ?? "").toLowerCase();
      if (category && !category.includes("standard")) continue;
      const saleAddress = [row.paon?.value, row.street?.value].filter(Boolean).join(" ") || "Address not stated";
      const sale: Sale = {
        address: saleAddress,
        postcode: row.postcode?.value ?? "",
        price: Number(row.amount?.value),
        date: row.date?.value ?? "",
        type,
        onThisAddress: onThisAddress(saleAddress, address),
      };
      if (!Number.isFinite(sale.price)) continue;
      sales.push(sale);
    }
    return { sales, error: null };
  }
  return {
    sales: [],
    error: `Land Registry returned HTTP ${lastStatus || 429}. Sale prices were not filled.`,
  };
}

async function pricePaid(
  postcode: string,
  latitude: number,
  longitude: number,
  houseType: string,
  address: string,
): Promise<{ sales: Sale[]; error: string | null; radius: string }> {
  const found = await runSalesQuery(
    salesQuery(await sampleAround(postcode, latitude, longitude), houseType),
    houseType,
    address,
  );
  return { ...found, radius: "at the postcode and about 1 km and 3 km away" };
}

async function websiteStatus(url: string | null): Promise<number | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    return response.status;
  } catch {
    return null;
  }
}

function asSites(entities: PlanningEntity[]): HousingSiteHit[] {
  return entities
    .filter((entity) => entity.dataset && HOUSING_DATASETS.has(entity.dataset))
    .map((entity) => ({
      name: entity.name ?? "",
      dataset: entity.dataset ?? "site",
      reference: entity.reference ?? null,
    }));
}

export async function lookupPostcode(raw: string, address: string, houseType: string): Promise<PostcodeLookup> {
  const postcode = normalizePostcode(raw);
  const site = address.trim();
  if (!postcode) {
    const error = new Error("Enter a UK postcode.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  if (site.length < 3) {
    const error = new Error("Enter the land address.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  if (!isHouseType(houseType)) {
    const error = new Error("Choose a house type.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const sector = postcodeSector(postcode);
  const [postcodePayload, authorities, cilSchedules] = await Promise.all([
    getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`),
    loadAuthorities(),
    loadCilSchedules(),
  ]);
  const result = (postcodePayload as { result?: Record<string, unknown> }).result;
  if (!result) {
    const error = new Error("That postcode was not found.");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const gss = typeof result.codes === "object" && result.codes && "admin_district" in result.codes
    ? String((result.codes as { admin_district?: string }).admin_district ?? "")
    : "";
  const authority = gss ? authorities.get(gss) : undefined;
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  const orgId = authority?.["organisation-entity"];
  const cilDocuments: CilDocument[] = cilSchedules
    .filter((schedule) => orgId != null && schedule["organisation-entity"] === orgId)
    .map((schedule) => ({
      name: schedule.name ?? "CIL schedule",
      documentUrl: schedule["document-url"] ?? null,
      documentationUrl: schedule["documentation-url"] ?? null,
      adoptedDate: schedule["adopted-date"] || null,
    }));

  const point = Number.isFinite(latitude) && Number.isFinite(longitude);
  const [matches, brownfield, brownfieldSites, developmentSites, sales, status] = await Promise.all([
    planningSearch({ q: postcode, limit: "50" }).catch(() => [] as PlanningEntity[]),
    point
      ? planningSearch({
          dataset: "brownfield-land",
          latitude: String(latitude),
          longitude: String(longitude),
          limit: "10",
        }).catch(() => [] as PlanningEntity[])
      : Promise.resolve([] as PlanningEntity[]),
    point
      ? planningSearch({
          dataset: "brownfield-site",
          latitude: String(latitude),
          longitude: String(longitude),
          limit: "10",
        }).catch(() => [] as PlanningEntity[])
      : Promise.resolve([] as PlanningEntity[]),
    point
      ? planningSearch({
          dataset: "site",
          latitude: String(latitude),
          longitude: String(longitude),
          limit: "10",
        }).catch(() => [] as PlanningEntity[])
      : Promise.resolve([] as PlanningEntity[]),
    pricePaid(postcode, latitude, longitude, houseType, site).catch((error: unknown) => ({
      sales: [] as Sale[],
      error: error instanceof Error ? error.message : "Price Paid could not be read.",
      radius: "not retrieved",
    })),
    websiteStatus(authority?.website ?? null),
  ]);

  const lpa = matches.find((entity) => entity.dataset === "local-planning-authority");
  const parish = matches.find((entity) => entity.dataset === "parish");
  const ward = matches.find((entity) => entity.dataset === "ward");
  const builtUp = matches.find((entity) => entity.dataset === "built-up-area");
  const sites = [
    ...asSites(matches),
    ...asSites(brownfield),
    ...asSites(brownfieldSites),
    ...asSites(developmentSites),
  ];
  const seen = new Set<string>();
  const uniqueSites = sites.filter((site) => {
    const key = `${site.dataset}|${site.reference}|${site.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const notes = describeCouncil({
    postcode,
    authorityName: authority?.name || String(result.admin_district ?? "the local authority"),
    gss: gss || null,
    website: authority?.website ?? null,
    websiteStatus: status,
    cilDocuments,
    sites: uniqueSites,
  });

  const citations: Citation[] = [
    {
      label: "HM Land Registry Price Paid Data",
      url: "https://landregistry.data.gov.uk/landregistry/query",
      date: `Standard ${houseTypeLabel(houseType)} sales ${sales.radius} since 1 January 2023, retrieved ${RETRIEVED_ON}`,
      value: sales.error
        ? sales.error
        : `${sales.sales.length} ${houseTypeLabel(houseType)} sales. ${sales.sales.filter((sale) => sale.onThisAddress).length} match the typed address.`,
    },
    {
      label: "Planning application fees in England from 1 April 2026",
      url: "https://assets.publishing.service.gov.uk/media/69a073bb07d7bff3604d6df6/Planning_fees_-_annual_indexation_from_1_April_2026.pdf",
      date: "In force 1 April 2026",
      value: "£610 per new dwelling under 10 homes, £659 each for 10 to 50.",
    },
    ...notes.citations,
  ];

  return {
    postcode,
    retrievedOn: RETRIEVED_ON,
    sector,
    latitude,
    longitude,
    authorityName: authority?.name || String(result.admin_district ?? ""),
    gss: gss || null,
    lpaName: lpa?.name ?? null,
    parish: parish?.name ?? (typeof result.parish === "string" ? result.parish : null),
    ward: ward?.name ?? (typeof result.admin_ward === "string" ? result.admin_ward : null),
    builtUpArea: builtUp?.name ?? null,
    country: typeof result.country === "string" ? result.country : null,
    website: authority?.website ?? null,
    address: site,
    houseType,
    unitPrice: average(sales.sales),
    sales: sales.sales,
    salesError: sales.error,
    cilRatePerM2: notes.cilRatePerM2,
    cilSummary: notes.cilSummary,
    s106Amount: notes.s106Amount,
    s106Summary: notes.s106Summary,
    onPublishedSite: notes.onPublishedSite,
    siteSummary: notes.siteSummary,
    buildSummary: notes.buildSummary,
    citations,
  };
}
