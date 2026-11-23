/**
 * Replica of "BuildUp Master Basic Appraisal Hesketh.xlsx".
 *
 * Blank inputs stay blank. Arithmetic that mirrors Excel uses 0 for a blank
 * only inside the workbook scenario, where that is what the sheet does.
 * A live scenario with a missing cost does not return a residual quote.
 */

export const SQFT_PER_M2 = 10.764;

/** Residual cell C94 adds back 1.25% of GDV, hardcoded, not the agency input. */
export const RESIDUAL_AGENCY_ADD_BACK = 0.0125;

export const BUILD_MONTHS = 24;

export type DistMethod = "Normal" | "Linear";

export interface HouseTypeInput {
  name: string;
  units: number | null;
  /** Proposed GIFA on the base sheet, square feet per unit. */
  sizeSqft: number | null;
  finalPrice: number | null;
  buildCostPerSqft: number | null;
}

export interface AppraisalInputs {
  id: string;
  label: string;
  siteAddress: string | null;
  affordable: HouseTypeInput[];
  openMarket: HouseTypeInput[];
  /** Base L22. A typed sum, not 1.5% of GDV. */
  planningProvisional: number | null;
  /** Base J23. Statutory application fee. */
  planningApplicationFee: number | null;
  s106: number | null;
  existingBuildingM2: number | null;
  cilRatePerM2: number | null;
  utilitiesPerUnit: number | null;
  contingencyRate: number | null;
  architectRate: number | null;
  engineerRate: number | null;
  employersAgentRate: number | null;
  projectManagementRate: number | null;
  warrantyPerUnit: number | null;
  buildingRegsPerUnit: number | null;
  adoptionFees: number | null;
  insuranceBonds: number | null;
  associatedLegalFees: number | null;
  showHome: number | null;
  estateAgencyRate: number | null;
  advertising: number | null;
  brochures: number | null;
  siteSalesSign: number | null;
  salesLegalPerUnit: number | null;
  siteValue: number | null;
  /** Base L84. Not the Fact Find SDLT formula. */
  stampDutyManual: number | null;
  landLegalRate: number | null;
  targetProfitOnSale: number | null;
  seniorHeaderRate: number | null;
  /** Cashflow G21. False keeps land out of the month-1 draw. */
  landDrawnInMonthOne: boolean;
  buildStartMonth: number;
  /** Exclusive end month, matching S Curve E8. */
  buildEndMonth: number;
  distMethod: DistMethod;
  /**
   * Inputs that must be present before a residual is treated as a quote.
   * Site value is the output, so it is not required.
   */
  residualRequires: (keyof AppraisalInputs | "house-prices" | "build-rates")[];
}

export interface CostStack {
  planning: number;
  cilBaseM2: number;
  cil: number;
  s106: number;
  contributions: number;
  abnormals: number;
  utilities: number;
  build: number;
  construction: number;
  contingency: number;
  professionalFees: number;
  sales: number;
  estateAgency: number;
  landAcquisition: number;
  /** Adoption, bonds and associated legal sit on the sheet but outside O87. */
  omittedFees: number;
  total: number;
}

export interface CashflowSummary {
  durationMonths: number;
  constructionBundle: number;
  monthlyConstructionShare: number[];
  feesDrawn: number;
  sheetSeniorInterest: number;
  seniorInterestAllMonths: number;
  sheetMezzInterest: number;
  equityAt10Pct: number;
  equityAt5Pct: number;
  senior65Ltv: number;
  senior85Ltc: number;
  landDeficit: number;
}

export interface AppraisalResult {
  inputs: AppraisalInputs;
  units: number;
  gifaSqft: number;
  gifaM2: number;
  openMarketGifaM2: number;
  gdv: number;
  gdvComplete: boolean;
  costs: CostStack;
  profit: number;
  profitMargin: number;
  residualLandValue: number | null;
  blockers: string[];
  cashflow: CashflowSummary | null;
}

function n(value: number | null | undefined): number {
  return value == null || Number.isNaN(value) ? 0 : value;
}

export function tentWeights(duration: number): number[] {
  const weights: number[] = [];
  for (let month = 1; month <= duration; month += 1) {
    const folded = month <= duration / 2 ? month : duration - month + 1;
    weights.push(folded > 0 ? folded : 0);
  }
  return weights;
}

/** Month shares for months 1..24. The sheet's "Normal" curve is this tent map. */
export function monthlySpendShares(
  startMonth: number,
  endMonth: number,
  method: DistMethod,
): number[] {
  const shares = Array.from({ length: BUILD_MONTHS }, () => 0);
  const duration = endMonth - startMonth;
  if (duration <= 0) return shares;
  if (method === "Linear") {
    for (let month = 1; month <= BUILD_MONTHS; month += 1) {
      if (month >= startMonth && month < endMonth) shares[month - 1] = 1 / duration;
    }
    return shares;
  }
  const weights = tentWeights(duration);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  for (let month = 1; month <= BUILD_MONTHS; month += 1) {
    if (month >= startMonth && month < endMonth && sum !== 0) {
      shares[month - 1] = weights[month - startMonth] / sum;
    }
  }
  return shares;
}

interface Band {
  width: number | null;
  rate: number;
}

export function bandedTax(amount: number, bands: Band[]): number {
  if (amount <= 0) return 0;
  let remaining = amount;
  let tax = 0;
  for (const band of bands) {
    const slice = band.width == null ? remaining : Math.min(remaining, band.width);
    tax += slice * band.rate;
    remaining -= slice;
    if (remaining <= 0) break;
  }
  return tax;
}

/** Higher residential rates from 1 April 2025, plus the 2% non-resident surcharge. */
export function sdltHigherResidential(price: number, nonUkResident: boolean): number {
  const tax = bandedTax(price, [
    { width: 125_000, rate: 0.05 },
    { width: 125_000, rate: 0.07 },
    { width: 675_000, rate: 0.1 },
    { width: 575_000, rate: 0.15 },
    { width: null, rate: 0.17 },
  ]);
  return tax + (nonUkResident ? price * 0.02 : 0);
}

/**
 * Bands written into Fact Find B23. They match higher rates while the
 * nil-rate band was £250,000 (31 October 2024 to 31 March 2025).
 */
export function sdltWorkbookLegacyHigher(price: number, nonUkResident: boolean): number {
  const tax = bandedTax(price, [
    { width: 250_000, rate: 0.05 },
    { width: 675_000, rate: 0.1 },
    { width: 575_000, rate: 0.15 },
    { width: null, rate: 0.17 },
  ]);
  return tax + (nonUkResident ? price * 0.02 : 0);
}

export function sdltNonResidentialPremium(price: number): number {
  return bandedTax(price, [
    { width: 150_000, rate: 0 },
    { width: 100_000, rate: 0.02 },
    { width: null, rate: 0.05 },
  ]);
}

export function npvOfRent(annualRent: number, years: number, discountRate: number): number {
  let total = 0;
  for (let year = 1; year <= years; year += 1) {
    total += annualRent / (1 + discountRate) ** year;
  }
  return total;
}

/** Non-residential lease rent: 0 to £150,000, 1% to £5m, 2% above. */
export function sdltOnNonResidentialRentNpv(npv: number): number {
  return bandedTax(npv, [
    { width: 150_000, rate: 0 },
    { width: 5_000_000 - 150_000, rate: 0.01 },
    { width: null, rate: 0.02 },
  ]);
}

/** Residential lease rent: 1% above £125,000. Confirmed by the GOV.UK worked example. */
export function sdltOnResidentialRentNpv(npv: number): number {
  return bandedTax(npv, [
    { width: 125_000, rate: 0 },
    { width: null, rate: 0.01 },
  ]);
}

/**
 * Full application fee for new dwellinghouses, England, from 1 April 2026.
 * Fewer than 10: £610 each. 10 to 50: £659 each. Above 50: £32,578 plus £196
 * each dwelling over 50, capped at £427,537.
 */
export function planningFeeNewDwellings(dwellingCount: number): number | null {
  if (!Number.isFinite(dwellingCount) || dwellingCount <= 0) return null;
  const homes = Math.floor(dwellingCount);
  if (homes < 10) return homes * 610;
  if (homes <= 50) return homes * 659;
  return Math.min(427_537, 32_578 + (homes - 50) * 196);
}

function sumInterest(values: number[], from: number, toInclusive: number): number {
  let total = 0;
  for (let index = from; index <= toInclusive; index += 1) total += values[index] ?? 0;
  return total;
}

function row11Prior(month: number, interest: number[]): number {
  if (month < 12) return 0;
  if (month === 15) return sumInterest(interest, 1, 3);
  const count = month - 11;
  return sumInterest(interest, 0, count - 1);
}

export function appraise(inputs: AppraisalInputs): AppraisalResult {
  const affordable = inputs.affordable.map(measure);
  const openMarket = inputs.openMarket.map(measure);
  const all = [...affordable, ...openMarket];
  const units = all.reduce((total, row) => total + row.units, 0);
  const gifaSqft = all.reduce((total, row) => total + row.sqft, 0);
  const gifaM2 = all.reduce((total, row) => total + row.m2, 0);
  const openMarketGifaM2 = openMarket.reduce((total, row) => total + row.m2, 0);
  const gdv = all.reduce((total, row) => total + row.gdv, 0);
  const build = all.reduce((total, row) => total + row.build, 0);

  const pricedRows = [...inputs.affordable, ...inputs.openMarket].filter(
    (row) => n(row.units) > 0,
  );
  const gdvComplete = pricedRows.length > 0 && pricedRows.every((row) => row.finalPrice != null);

  const planning = n(inputs.planningProvisional) + n(inputs.planningApplicationFee);
  const cilBaseM2 = openMarketGifaM2 - n(inputs.existingBuildingM2);
  const cil = cilBaseM2 * n(inputs.cilRatePerM2);
  const s106 = n(inputs.s106);
  const contributions = s106 + cil;
  const abnormals = 0;
  const utilities = n(inputs.utilitiesPerUnit) * units;
  const construction = utilities + build;
  const contingency = construction * n(inputs.contingencyRate);
  const feeBase = construction + contingency;
  const professionalFees =
    feeBase * n(inputs.architectRate) +
    feeBase * n(inputs.engineerRate) +
    feeBase * n(inputs.employersAgentRate) +
    feeBase * n(inputs.projectManagementRate) +
    n(inputs.warrantyPerUnit) * units +
    n(inputs.buildingRegsPerUnit) * units;
  const estateAgency = gdv * n(inputs.estateAgencyRate);
  const sales =
    n(inputs.showHome) +
    estateAgency +
    n(inputs.advertising) +
    n(inputs.brochures) +
    n(inputs.siteSalesSign) +
    n(inputs.salesLegalPerUnit) * units;
  const landAcquisition =
    n(inputs.siteValue) +
    n(inputs.stampDutyManual) +
    n(inputs.siteValue) * n(inputs.landLegalRate);
  const omittedFees =
    n(inputs.adoptionFees) + n(inputs.insuranceBonds) + n(inputs.associatedLegalFees);
  const total =
    planning + contributions + abnormals + construction + contingency + professionalFees + sales + landAcquisition;

  const profit = gdv - total;
  const profitMargin = gdv === 0 ? 0 : profit / gdv;
  const residualIfComputed =
    gdv * (1 - n(inputs.targetProfitOnSale)) -
    (total - landAcquisition - gdv * RESIDUAL_AGENCY_ADD_BACK);

  const blockers = residualBlockers(inputs, pricedRows);
  const residualLandValue = blockers.length === 0 ? residualIfComputed : null;
  const cashflow =
    blockers.length === 0
      ? buildCashflow({
          inputs,
          gdv,
          contributions,
          abnormals,
          construction,
          contingency,
          professionalFees,
          landAcquisition,
        })
      : null;

  return {
    inputs,
    units,
    gifaSqft,
    gifaM2,
    openMarketGifaM2,
    gdv,
    gdvComplete,
    costs: {
      planning,
      cilBaseM2,
      cil,
      s106,
      contributions,
      abnormals,
      utilities,
      build,
      construction,
      contingency,
      professionalFees,
      sales,
      estateAgency,
      landAcquisition,
      omittedFees,
      total,
    },
    profit,
    profitMargin,
    residualLandValue,
    blockers,
    cashflow,
  };
}

function residualBlockers(inputs: AppraisalInputs, pricedRows: HouseTypeInput[]): string[] {
  const blockers: string[] = [];
  const requireKey = (key: keyof AppraisalInputs, label: string) => {
    if (!inputs.residualRequires.includes(key)) return;
    if (inputs[key] == null) blockers.push(label);
  };
  if (inputs.residualRequires.includes("house-prices")) {
    const missing = pricedRows.filter((row) => row.finalPrice == null).map((row) => row.name);
    if (missing.length > 0) blockers.push(`Sale price missing for ${missing.join(", ")}`);
  }
  if (inputs.residualRequires.includes("build-rates")) {
    const missing = pricedRows.filter((row) => row.buildCostPerSqft == null).map((row) => row.name);
    if (missing.length > 0) blockers.push(`Build cost £/sq ft missing for ${missing.join(", ")}`);
  }
  requireKey("planningProvisional", "Planning provisional sum");
  requireKey("planningApplicationFee", "Planning application fee");
  requireKey("s106", "Section 106 contribution");
  requireKey("cilRatePerM2", "CIL rate £/m²");
  requireKey("utilitiesPerUnit", "Utilities allowance £/unit");
  requireKey("contingencyRate", "Contingency rate");
  requireKey("warrantyPerUnit", "Building warranty £/unit");
  requireKey("buildingRegsPerUnit", "Building regulations fee £/unit");
  requireKey("targetProfitOnSale", "Target profit on sale");
  requireKey("stampDutyManual", "Manual stamp duty line");
  return blockers;
}

function measure(row: HouseTypeInput) {
  const units = n(row.units);
  const sqftEach = n(row.sizeSqft);
  const sqft = sqftEach * units;
  return {
    units,
    sqft,
    m2: sqft / SQFT_PER_M2,
    gdv: n(row.finalPrice) * units,
    build: n(row.buildCostPerSqft) * sqft,
  };
}

function buildCashflow(args: {
  inputs: AppraisalInputs;
  gdv: number;
  contributions: number;
  abnormals: number;
  construction: number;
  contingency: number;
  professionalFees: number;
  landAcquisition: number;
}): CashflowSummary {
  const { inputs } = args;
  const constructionBundle = args.abnormals + args.construction + args.contingency;
  const shares = monthlySpendShares(
    inputs.buildStartMonth,
    inputs.buildEndMonth,
    inputs.distMethod,
  );
  const constructionMonthly = shares.map((share) => share * constructionBundle);
  const feeMonthly = Array.from({ length: BUILD_MONTHS }, (_, month) =>
    month === 0 ? 0 : args.professionalFees / 21,
  );
  const s106Monthly = Array.from({ length: BUILD_MONTHS }, (_, month) =>
    month === 0 ? args.contributions : 0,
  );
  const facilityDraw = args.contributions + constructionBundle + args.professionalFees;
  const senior65 = args.gdv * 0.65;
  const totalCost = args.landAcquisition + facilityDraw;
  const senior85 = totalCost * 0.85;
  const landPayment = Math.min(senior65, senior85) - facilityDraw;
  const landMonthly = Array.from({ length: BUILD_MONTHS }, (_, month) =>
    month === 0 && inputs.landDrawnInMonthOne ? landPayment : 0,
  );
  const monthly = constructionMonthly.map(
    (amount, month) => amount + feeMonthly[month] + s106Monthly[month] + landMonthly[month],
  );
  const cumulative: number[] = [];
  monthly.forEach((amount, month) => {
    cumulative[month] = (cumulative[month - 1] ?? 0) + amount;
  });
  const landDeficit = args.landAcquisition - landPayment;
  const header = n(inputs.seniorHeaderRate);

  const row11 = Array.from({ length: BUILD_MONTHS }, () => 0);
  for (let month = 0; month < BUILD_MONTHS; month += 1) {
    let rate = 0.1;
    if (month < 2) rate = header;
    if (month === 23) rate = 0;
    row11[month] = (cumulative[month] + row11Prior(month, row11)) * (rate / 12);
  }

  const row16 = Array.from({ length: BUILD_MONTHS }, () => 0);
  for (let month = 0; month < BUILD_MONTHS; month += 1) {
    const prior = month < 12 ? 0 : row16[month - 12];
    row16[month] = (cumulative[month] + prior + landDeficit) * (0.07 / 12);
  }

  const mezzFacility = landDeficit - 0.05 * totalCost;
  const row12 = Array.from({ length: BUILD_MONTHS }, () => 0);
  for (let month = 0; month < BUILD_MONTHS; month += 1) {
    if (month === 23) continue;
    const prior = month < 12 ? 0 : sumInterest(row12, 0, month - 12);
    row12[month] = (mezzFacility + prior) * (0.18 / 12);
  }

  return {
    durationMonths: inputs.buildEndMonth - inputs.buildStartMonth,
    constructionBundle,
    monthlyConstructionShare: shares,
    feesDrawn: feeMonthly.reduce((total, amount) => total + amount, 0),
    sheetSeniorInterest: sumInterest(row16, 0, 20),
    seniorInterestAllMonths: row16.reduce((total, amount) => total + amount, 0),
    sheetMezzInterest: sumInterest(row12, 0, 20),
    equityAt10Pct: totalCost * 0.1,
    equityAt5Pct: totalCost * 0.05,
    senior65Ltv: senior65,
    senior85Ltc: senior85,
    landDeficit,
  };
}
