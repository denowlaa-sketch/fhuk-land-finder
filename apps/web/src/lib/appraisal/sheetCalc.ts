import { planningFeeNewDwellings, SQFT_PER_M2 } from "./calculate";
import { formatGbp, houseTypeLabel, type HouseType } from "./quoteView";
import type { PostcodeLookup } from "./lookupPostcode";

export interface SheetInputs {
  postcode: string;
  address: string;
  houseType: HouseType | "";
  planningLink: string;
  aff1Units: string;
  aff1Sqft: string;
  aff1Price: string;
  aff1Build: string;
  aff2Units: string;
  aff2Sqft: string;
  aff2Price: string;
  aff2Build: string;
  ht1Units: string;
  ht1Sqft: string;
  ht1Price: string;
  ht1Build: string;
  ht2Units: string;
  ht2Sqft: string;
  ht2Price: string;
  ht2Build: string;
  ht3Units: string;
  ht3Sqft: string;
  ht3Price: string;
  ht3Build: string;
  ht4Units: string;
  ht4Sqft: string;
  ht4Price: string;
  ht4Build: string;
  planningProvisional: string;
  planningFee: string;
  s106: string;
  existingM2: string;
  cilRate: string;
  utilitiesPerUnit: string;
  contingencyRate: string;
  architectRate: string;
  engineerRate: string;
  employersAgentRate: string;
  projectManagementRate: string;
  warrantyPerUnit: string;
  buildingRegsPerUnit: string;
  estateAgencyRate: string;
  showHome: string;
  advertising: string;
  brochures: string;
  siteSalesSign: string;
  salesLegalPerUnit: string;
  stampDuty: string;
}

export function emptySheet(): SheetInputs {
  return {
    postcode: "",
    address: "",
    houseType: "",
    planningLink: "",
    aff1Units: "",
    aff1Sqft: "",
    aff1Price: "",
    aff1Build: "",
    aff2Units: "",
    aff2Sqft: "",
    aff2Price: "",
    aff2Build: "",
    ht1Units: "",
    ht1Sqft: "",
    ht1Price: "",
    ht1Build: "",
    ht2Units: "",
    ht2Sqft: "",
    ht2Price: "",
    ht2Build: "",
    ht3Units: "",
    ht3Sqft: "",
    ht3Price: "",
    ht3Build: "",
    ht4Units: "",
    ht4Sqft: "",
    ht4Price: "",
    ht4Build: "",
    planningProvisional: "",
    planningFee: "",
    s106: "",
    existingM2: "",
    cilRate: "",
    utilitiesPerUnit: "",
    contingencyRate: "",
    architectRate: "",
    engineerRate: "",
    employersAgentRate: "",
    projectManagementRate: "",
    warrantyPerUnit: "",
    buildingRegsPerUnit: "",
    estateAgencyRate: "",
    showHome: "",
    advertising: "",
    brochures: "",
    siteSalesSign: "",
    salesLegalPerUnit: "",
    stampDuty: "",
  };
}

export interface SheetRow {
  id: string;
  label: string;
  cell: string;
  inputKey?: keyof SheetInputs;
  result: string;
  note: string;
  /** user = type it; source = a lookup may fill it; formula = calculated; link = blank until a page is linked */
  mode: "user" | "source" | "formula" | "link" | "section";
}

function num(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null): string {
  return value == null ? "" : formatGbp(value);
}

interface TypeLine {
  units: number | null;
  sqft: number | null;
  price: number | null;
  build: number | null;
}

function typeLine(units: string, sqft: string, price: string, build: string): TypeLine {
  return { units: num(units), sqft: num(sqft), price: num(price), build: num(build) };
}

function active(line: TypeLine): boolean {
  return line.units != null || line.sqft != null || line.price != null || line.build != null;
}

function saleOf(line: TypeLine): number | null {
  if (!active(line)) return 0;
  if (line.units == null || line.price == null) return null;
  return line.price * line.units;
}

function areaOf(line: TypeLine): number | null {
  if (!active(line)) return 0;
  if (line.units == null || line.sqft == null) return null;
  return line.sqft * line.units;
}

function buildOf(line: TypeLine): number | null {
  if (!active(line)) return 0;
  const area = areaOf(line);
  if (area == null || line.build == null) return null;
  return line.build * area;
}

export function evaluateSheet(inputs: SheetInputs, lookup: PostcodeLookup | null): { rows: SheetRow[]; blankCells: string[] } {
  const affordable = [
    typeLine(inputs.aff1Units, inputs.aff1Sqft, inputs.aff1Price, inputs.aff1Build),
    typeLine(inputs.aff2Units, inputs.aff2Sqft, inputs.aff2Price, inputs.aff2Build),
  ];
  const market = [
    typeLine(inputs.ht1Units, inputs.ht1Sqft, inputs.ht1Price, inputs.ht1Build),
    typeLine(inputs.ht2Units, inputs.ht2Sqft, inputs.ht2Price, inputs.ht2Build),
    typeLine(inputs.ht3Units, inputs.ht3Sqft, inputs.ht3Price, inputs.ht3Build),
    typeLine(inputs.ht4Units, inputs.ht4Sqft, inputs.ht4Price, inputs.ht4Build),
  ];
  const all = [...affordable, ...market];
  const sales = all.map(saleOf);
  const areas = all.map(areaOf);
  const builds = all.map(buildOf);
  const sumReady = (values: (number | null)[]): number | null => {
    let total = 0;
    for (const value of values) {
      if (value == null) return null;
      total += value;
    }
    return total;
  };
  const anyActive = all.some((line) => active(line));
  const gdv = !anyActive ? null : sumReady(sales);
  const unitsKnown = all.some((line) => active(line) && line.units == null)
    ? null
    : all.reduce((sum, line) => sum + (line.units ?? 0), 0);
  const marketArea = sumReady(areas.slice(2));
  const marketM2 = marketArea == null ? null : marketArea / SQFT_PER_M2;
  const existing = num(inputs.existingM2);
  const cilRate = num(inputs.cilRate);
  const cil = marketM2 != null && existing != null && cilRate != null ? (marketM2 - existing) * cilRate : null;
  const statutoryFee =
    lookup?.country === "England" && unitsKnown != null && unitsKnown > 0 ? planningFeeNewDwellings(unitsKnown) : null;
  const planningFee = num(inputs.planningFee) ?? statutoryFee;
  const provisional = num(inputs.planningProvisional);
  const s106 = num(inputs.s106);
  const utilitiesRate = num(inputs.utilitiesPerUnit);
  const utilities = utilitiesRate != null && unitsKnown != null ? utilitiesRate * unitsKnown : null;
  const build = !anyActive ? null : sumReady(builds);
  const construction = build != null && utilities != null ? build + utilities : null;
  const contingencyRate = num(inputs.contingencyRate);
  const contingency = construction != null && contingencyRate != null ? construction * contingencyRate : null;
  const feeBase = construction != null && contingency != null ? construction + contingency : null;
  const feeRate = (value: string) => num(value);
  const architect = feeBase != null && feeRate(inputs.architectRate) != null ? feeBase * feeRate(inputs.architectRate)! : null;
  const engineer = feeBase != null && feeRate(inputs.engineerRate) != null ? feeBase * feeRate(inputs.engineerRate)! : null;
  const agent = feeBase != null && feeRate(inputs.employersAgentRate) != null ? feeBase * feeRate(inputs.employersAgentRate)! : null;
  const pm = feeBase != null && feeRate(inputs.projectManagementRate) != null ? feeBase * feeRate(inputs.projectManagementRate)! : null;
  const warrantyRate = num(inputs.warrantyPerUnit);
  const bregsRate = num(inputs.buildingRegsPerUnit);
  const warranty = warrantyRate != null && unitsKnown != null ? warrantyRate * unitsKnown : null;
  const bregs = bregsRate != null && unitsKnown != null ? bregsRate * unitsKnown : null;
  const agencyRate = num(inputs.estateAgencyRate);
  const agency = gdv != null && agencyRate != null ? gdv * agencyRate : null;
  const optional = (value: string) => num(value) ?? 0;
  const showHome = optional(inputs.showHome);
  const advertising = optional(inputs.advertising);
  const brochures = optional(inputs.brochures);
  const sign = optional(inputs.siteSalesSign);
  const salesLegal = num(inputs.salesLegalPerUnit) != null && unitsKnown != null ? num(inputs.salesLegalPerUnit)! * unitsKnown : optional(inputs.salesLegalPerUnit);

  const blockers: string[] = [];
  if (gdv == null || gdv === 0) blockers.push("GDV (O19)");
  if (provisional == null) blockers.push("L22 planning provisional sum");
  if (planningFee == null) blockers.push("J23 planning application fee");
  if (s106 == null) blockers.push("J38 Section 106");
  if (cil == null) blockers.push("J39 CIL");
  if (utilities == null) blockers.push("J51 utilities");
  if (build == null) blockers.push("J58:J61 build cost");
  if (contingency == null) blockers.push("J63 contingency rate");
  if (architect == null || engineer == null || agent == null || pm == null) blockers.push("G65:G68 professional fee rates");
  if (warranty == null) blockers.push("G69 warranty");
  if (bregs == null) blockers.push("G70 building regulations");
  if (agency == null) blockers.push("J76 estate agency rate");

  const fees = architect != null && engineer != null && agent != null && pm != null && warranty != null && bregs != null
    ? architect + engineer + agent + pm + warranty + bregs
    : null;
  const salesCosts = agency != null ? agency + showHome + advertising + brochures + sign + salesLegal : null;
  const planningTotal = provisional != null && planningFee != null ? provisional + planningFee : null;
  const contributions = s106 != null && cil != null ? s106 + cil : null;
  const total =
    planningTotal != null && contributions != null && construction != null && contingency != null && fees != null && salesCosts != null
      ? planningTotal + contributions + construction + contingency + fees + salesCosts
      : null;
  const profit = gdv != null && total != null ? gdv - total : null;
  const residual =
    blockers.length === 0 && gdv != null && total != null ? gdv * (1 - 0.2) - (total - gdv * 0.0125) : null;

  const typeName = inputs.houseType ? houseTypeLabel(inputs.houseType) : "Choose a house type";
  const priceNote = lookup
    ? lookup.unitPrice == null
      ? `No standard ${typeName} sales in the sample. Comparables F27 stays blank until Land Registry has one. ${lookup.salesError ?? ""}`
      : `Average of ${lookup.sales.length} standard ${typeName} sales since 1 January 2023. ${lookup.sales.filter((sale) => sale.onThisAddress).length} match this address. Other house types are not priced from this lookup.`
    : "Look up the postcode to fill this from Land Registry for the selected house type only.";
  const cilNote = lookup?.cilSummary ?? "Needs the council CIL charging schedule. Leave blank if the schedule is zoned or was not read.";
  const s106Note = lookup?.s106Summary ?? "Needs a council Section 106 tariff or SPD that states a figure for this scheme.";
  const buildNote = lookup?.buildSummary ?? "Needs a published build-cost rate for this house type. BCIS is paid and is not used.";
  const siteNote = lookup?.siteSummary ?? "Needs the council SHLAA, HELAA, or SHELAA, or a planning-data housing site for this address.";

  const row = (
    id: string,
    label: string,
    cell: string,
    mode: SheetRow["mode"],
    note: string,
    result = "",
    inputKey?: keyof SheetInputs,
  ): SheetRow => ({ id, label, cell, mode, note, result, inputKey });

  const rows: SheetRow[] = [
    row("site", "Site", "", "section", ""),
    row("b2", "Site address", "Base B2", "user", "You type the land address.", inputs.address, "address"),
    row("pc", "Postcode", "Base B2", "user", "You type the postcode. It chooses the council and the Land Registry search.", inputs.postcode, "postcode"),
    row("type", "House type", "Comparables F13", "user", "Chooses which Land Registry sales and which build-cost row are used. Other types stay empty until you type them.", typeName, "houseType"),
    row("b3", "Planning link", "Base B3", "link", "Blank until you paste the planning application or a council page.", inputs.planningLink, "planningLink"),
    row("housing", "Housing land", "SHLAA / HELAA", "link", siteNote),
    row("rev", "Revenue", "", "section", ""),
    row("aff", "Affordable units", "Comparables C8:C9", "user", "Type a count only if this land has affordable homes. Empty is not a scheme of zero unless you type 0.", "", "aff1Units"),
    row("ht1", `${typeName} units`, "Comparables C13", "user", "You type the count. A published site yield is used only when that site covers this address.", "", "ht1Units"),
    row("e13", `${typeName} floor area`, "Base E13", "user", "Square feet per home. Price Paid does not publish floor area. Type it, or leave it blank.", "", "ht1Sqft"),
    row("f27", `${typeName} unit price`, "Comparables F27", "source", priceNote, money(num(inputs.ht1Price)), "ht1Price"),
    row("ht2", "House type 2 units, area, price", "Comparables C14, Base E14, F28", "user", "Blank. Not assumed to be a second house type.", "", "ht2Units"),
    row("ht3", "House type 3", "Comparables C15, F29", "user", "Blank until you add another type.", "", "ht3Units"),
    row("ht4", "House type 4", "Comparables C16, F30", "user", "Blank until you add another type.", "", "ht4Units"),
    row("gdv", "Gross development value", "Base O19", "formula", gdv == null ? "Blank until every house type that has units also has a price." : "Sum of unit price × units.", money(gdv)),
    row("plan", "Planning and contributions", "", "section", ""),
    row("l22", "Planning provisional sum", "Base L22", "user", "The template’s typed sum is not a published fee. Type one or leave it blank.", money(provisional), "planningProvisional"),
    row("j23", "Planning application fee", "Base J23", "source", statutoryFee != null && num(inputs.planningFee) == null ? "England schedule from 1 April 2026, times the unit count you typed." : "Type a fee, or type the unit count and the England schedule fills it.", money(planningFee), "planningFee"),
    row("reports", "Planning reports", "Base B24:B36", "link", "Fact Find checkboxes are off, so these rows add nothing until you link a quote and type it."),
    row("j38", "Section 106", "Base J38", "link", s106Note, money(s106), "s106"),
    row("b2ff", "Existing building", "Fact Find B2", "link", "Blank. Not assumed to be 0 m².", existing == null ? "" : `${existing} m²`, "existingM2"),
    row("b3ff", "CIL rate", "Fact Find B3", "link", cilNote, cilRate == null ? "" : `${formatGbp(cilRate)} / m²`, "cilRate"),
    row("j39", "CIL charge", "Base J39", "formula", "Open-market m² minus Fact Find B2, times Fact Find B3. Blank if any of those is blank.", money(cil)),
    row("abn", "Abnormals", "Base B41:B49", "link", "Demolition, clearance, and the other Fact Find items are unticked. They add nothing until you type a cost."),
    row("build", "Construction", "", "section", ""),
    row("j51", "Utilities £ per dwelling", "Base J51", "link", "No published per-dwelling utilities figure. Type one or leave it blank. The amount under the box is the rate times the unit count.", money(utilities), "utilitiesPerUnit"),
    row("j58", `${typeName} build cost`, "Base J58", "link", buildNote, active(market[0]) ? money(buildOf(market[0])) : ""),
    row("j59", "Other types’ build cost", "Base J59:J61", "link", "Blank. A rate is not copied from the selected house type.", "", "ht2Build"),
    row("j63", "Contingency rate", "Base J63", "user", "Type a rate to run the formula. The template file uses 10%. That rate was not looked up.", money(contingency), "contingencyRate"),
    row("fees", "Fees", "", "section", ""),
    row("g65", "Architect rate", "Base G65", "user", "Type a rate. The template file uses 0.75% of construction plus contingency. Not looked up.", money(architect), "architectRate"),
    row("g66", "Engineer rate", "Base G66", "user", "Template file uses 0.5%. Not looked up.", money(engineer), "engineerRate"),
    row("g67", "Employer’s agent rate", "Base G67", "user", "Template file uses 2.5%. Not looked up.", money(agent), "employersAgentRate"),
    row("g68", "Project manager rate", "Base G68", "user", "Template file uses 2%. Not looked up.", money(pm), "projectManagementRate"),
    row("g69", "Building warranty £ per dwelling", "Base G69", "link", "No published per-dwelling warranty. Type one or leave it blank. The amount under the box is the rate times the unit count.", money(warranty), "warrantyPerUnit"),
    row("g70", "Building regulations £ per dwelling", "Base G70", "link", "No published per-dwelling fee. Type one or leave it blank. The amount under the box is the rate times the unit count.", money(bregs), "buildingRegsPerUnit"),
    row("g71", "Adoption, bonds, legal", "Base L71:L73", "user", "The template calculates these and then leaves them out of total costs. Type them only if you want them recorded."),
    row("sales", "Sales costs", "", "section", ""),
    row("j76", "Estate agency rate", "Base J76", "user", "Type a rate. The template file uses 1.25% of GDV. Not a quoted agency fee.", money(agency), "estateAgencyRate"),
    row(
      "m75",
      "Show home, advertising, brochures, sign",
      "Base M75:M79",
      "user",
      "Template amounts are 0. Leave blank to add nothing.",
      [inputs.showHome, inputs.advertising, inputs.brochures, inputs.siteSalesSign].some((value) => value.trim())
        ? money(showHome + advertising + brochures + sign)
        : "",
    ),
    row("land", "Land", "", "section", ""),
    row("l84", "Stamp duty", "Base L84", "link", "Not applied. The purchase structure is not stated, so the Fact Find SDLT block is not filled.", money(num(inputs.stampDuty)), "stampDuty"),
    row("c82", "Site value", "Base C82", "formula", "This is the residual, not an input. The template adds the whole land block back, so a typed site value does not change C94."),
    row("out", "Result", "", "section", ""),
    row("o87", "Total costs", "Base O87", "formula", "Sum of the section totals. Adoption, bonds, and associated legal fees are left out, as on the template.", money(total)),
    row("o89", "Profit", "Base O89", "formula", "GDV minus total costs. Blank if a cost cell is blank. A blank is not treated as zero.", money(profit)),
    row("c93", "Profit target", "Base C93", "formula", "The template target is 20% of GDV.", "20%"),
    row("c94", "Residual land value", "Base C94", "formula", residual == null ? `Blank until these cells are filled: ${blockers.join("; ")}.` : "GDV × (1 − 20%) minus costs, adding back 1.25% of GDV. Finance is not deducted.", money(residual)),
  ];

  const blankCells = rows.filter((item) => item.mode !== "section" && item.mode !== "formula" && !item.result && item.mode !== "user").map((item) => item.cell);
  return { rows, blankCells };
}
