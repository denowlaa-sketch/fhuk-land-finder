import { planningFeeNewDwellings, SQFT_PER_M2 } from "./calculate";

export interface Scheme {
  semiUnits: number;
  semiSqft: number;
  detachedUnits: number;
  detachedSqft: number;
  targetProfit: number;
}

/** The Hesketh sheet’s mix. Shown as an editable default, not as a fact about the postcode. */
export const HESKETH_SCHEME: Scheme = {
  semiUnits: 8,
  semiSqft: 900,
  detachedUnits: 1,
  detachedSqft: 1000,
  targetProfit: 0.2,
};

export interface QuoteFacts {
  semiPrice: number | null;
  detachedPrice: number | null;
  cilRatePerM2: number | null;
  /** Unknown existing floorspace stays null. It is not assumed to be zero. */
  existingBuildingM2: number | null;
  s106: number | null;
  buildSemiPerSqft: number | null;
  buildDetachedPerSqft: number | null;
  utilitiesPerUnit: number | null;
  warrantyPerUnit: number | null;
  buildingRegsPerUnit: number | null;
  planningProvisional: number | null;
  country: string | null;
  siteSentence: string;
  cilSentence: string;
  s106Sentence: string;
}

export interface QuoteLine {
  id: string;
  label: string;
  /** Pounds. Null means the figure was not filled. */
  amount: number | null;
  /** Non-money display, such as a floor area. */
  text: string | null;
  detail: string;
}

export interface QuoteView {
  dwellings: number;
  gifaSqft: number;
  gifaM2: number;
  gdv: number | null;
  lines: QuoteLine[];
  residual: number | null;
  profit: number | null;
  profitOnGdv: number | null;
  missing: string[];
  conclusion: string;
}

function priceFor(units: number, price: number | null): number | null {
  if (units <= 0) return 0;
  return price;
}

function line(
  id: string,
  label: string,
  amount: number | null,
  detail: string,
  text: string | null = null,
): QuoteLine {
  return { id, label, amount, text, detail };
}

export function quoteView(scheme: Scheme, facts: QuoteFacts): QuoteView {
  const dwellings = scheme.semiUnits + scheme.detachedUnits;
  const gifaSqft = scheme.semiUnits * scheme.semiSqft + scheme.detachedUnits * scheme.detachedSqft;
  const gifaM2 = gifaSqft / SQFT_PER_M2;
  const semiPrice = priceFor(scheme.semiUnits, facts.semiPrice);
  const detachedPrice = priceFor(scheme.detachedUnits, facts.detachedPrice);
  const gdv =
    semiPrice == null || detachedPrice == null
      ? null
      : scheme.semiUnits * semiPrice + scheme.detachedUnits * detachedPrice;

  const planningFee = facts.country === "England" ? planningFeeNewDwellings(dwellings) : null;

  const semiBuild =
    scheme.semiUnits <= 0
      ? 0
      : facts.buildSemiPerSqft == null
        ? null
        : facts.buildSemiPerSqft * scheme.semiSqft * scheme.semiUnits;
  const detachedBuild =
    scheme.detachedUnits <= 0
      ? 0
      : facts.buildDetachedPerSqft == null
        ? null
        : facts.buildDetachedPerSqft * scheme.detachedSqft * scheme.detachedUnits;
  const build = semiBuild == null || detachedBuild == null ? null : semiBuild + detachedBuild;
  const utilities = facts.utilitiesPerUnit == null ? null : facts.utilitiesPerUnit * dwellings;
  const construction = build == null || utilities == null ? null : build + utilities;
  const contingency = construction == null ? null : construction * 0.1;
  const feeBase = construction == null || contingency == null ? null : construction + contingency;
  const professional = feeBase == null ? null : feeBase * (0.0075 + 0.005 + 0.025 + 0.02);
  const warranty = facts.warrantyPerUnit == null ? null : facts.warrantyPerUnit * dwellings;
  const buildingRegs =
    facts.buildingRegsPerUnit == null ? null : facts.buildingRegsPerUnit * dwellings;
  const agency = gdv == null ? null : gdv * 0.0125;
  const cil =
    facts.cilRatePerM2 == null || facts.existingBuildingM2 == null
      ? null
      : (gifaM2 - facts.existingBuildingM2) * facts.cilRatePerM2;

  const missing: string[] = [];
  if (gdv == null) missing.push("sale prices for every house type still in the mix");
  if (facts.cilRatePerM2 == null) missing.push("a single CIL rate for this postcode");
  if (facts.existingBuildingM2 == null) missing.push("existing building floorspace");
  if (facts.s106 == null) missing.push("Section 106 contribution");
  if (build == null) missing.push("build cost");
  if (facts.utilitiesPerUnit == null) missing.push("utilities");
  if (facts.warrantyPerUnit == null) missing.push("building warranty");
  if (facts.buildingRegsPerUnit == null) missing.push("building regulations fees");
  if (facts.planningProvisional == null) missing.push("planning provisional sum");
  if (planningFee == null) missing.push("planning application fee");
  missing.push("abnormal costs");

  const lines: QuoteLine[] = [
    line(
      "gdv",
      "Gross development value",
      gdv,
      gdv == null
        ? "Needs a Price Paid average for each house type that still has units."
        : "Average standard sale price × the unit count you set, by semi-detached and detached.",
    ),
    line(
      "area",
      "Floor area",
      null,
      "Sizes are the assumption below, not Land Registry floor areas. Square feet ÷ 10.764.",
      `${gifaM2.toLocaleString("en-GB", { maximumFractionDigits: 2 })} m² (${gifaSqft.toLocaleString("en-GB")} sq ft)`,
    ),
    line("cil", "CIL", cil, facts.cilSentence),
    line("s106", "Section 106", facts.s106, facts.s106Sentence),
    line(
      "build",
      "Build cost",
      build,
      build == null
        ? "No published £ per square foot for this postcode. Not shown as zero."
        : "Build rate × floor area for each house type.",
    ),
    line(
      "utilities",
      "Utilities",
      utilities,
      utilities == null ? "No published per-dwelling utilities figure." : "Per dwelling × unit count.",
    ),
    line(
      "construction",
      "Construction",
      construction,
      "Build cost plus utilities. Blank if either part is blank.",
    ),
    line(
      "fees",
      "Professional fees",
      professional,
      "Architect 0.75%, engineer 0.5%, employer’s agent 2.5%, and project manager 2% of construction plus 10% contingency. Blank until construction is filled.",
    ),
    line(
      "warranty",
      "Warranty",
      warranty,
      warranty == null ? "No published per-dwelling warranty figure." : "Per dwelling × unit count.",
    ),
    line(
      "bregs",
      "Building regulations",
      buildingRegs,
      buildingRegs == null
        ? "No published per-dwelling building-regulations fee."
        : "Per dwelling × unit count.",
    ),
    line(
      "planning",
      "Planning application fee",
      planningFee,
      facts.country === "England"
        ? "England fee for new dwellinghouses in force from 1 April 2026, times the dwelling count. £610 each under 10 homes, £659 each for 10 to 50."
        : "The April 2026 dwelling fee is an England schedule. This postcode is not in England, so the fee is blank.",
    ),
    line(
      "provisional",
      "Planning provisional sum",
      facts.planningProvisional,
      "The sheet’s £22,500 is a typed sum, not a published fee. Left blank.",
    ),
    line("agency", "Estate agency", agency, "Sheet assumption of 1.25% of GDV, not a quoted agency fee."),
    line("profit", "Profit", null, `A ${Math.round(scheme.targetProfit * 100)}% profit on GDV is the target. Profit is not calculated while costs are blank.`),
    line(
      "residual",
      "Residual land value",
      null,
      "Withheld. A residual that treated a blank cost as zero would overstate the land value.",
    ),
  ];

  const targetPct = `${Math.round(scheme.targetProfit * 100)}%`;
  const conclusion = [
    facts.siteSentence,
    facts.cilSentence,
    facts.s106Sentence,
    `No residual land value is stated. A ${targetPct} profit on GDV is not confirmed because these inputs are blank and are not treated as zero: ${missing.join("; ")}.`,
  ].join(" ");

  return {
    dwellings,
    gifaSqft,
    gifaM2,
    gdv,
    lines,
    residual: null,
    profit: null,
    profitOnGdv: null,
    missing,
    conclusion,
  };
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
