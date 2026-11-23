import { planningFeeNewDwellings, SQFT_PER_M2 } from "./calculate";

export const HOUSE_TYPES = ["detached", "semi-detached", "terraced", "flat-maisonette"] as const;

export type HouseType = (typeof HOUSE_TYPES)[number];

export function isHouseType(value: string): value is HouseType {
  return (HOUSE_TYPES as readonly string[]).includes(value);
}

export function houseTypeLabel(type: HouseType): string {
  if (type === "flat-maisonette") return "Flat / maisonette";
  if (type === "semi-detached") return "Semi-detached";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export interface SheetFacts {
  address: string;
  postcode: string;
  houseType: HouseType;
  authorityName: string;
  /** Comparables F27. Average of the selected house type only. */
  unitPrice: number | null;
  /** Comparables C13. Null unless a source states a count for this address. */
  units: number | null;
  /** Base E13. Null unless a source states a floor area. */
  sizeSqft: number | null;
  cilRatePerM2: number | null;
  existingBuildingM2: number | null;
  s106: number | null;
  /** Build rate for the selected house type only. */
  buildPerSqft: number | null;
  utilitiesPerUnit: number | null;
  warrantyPerUnit: number | null;
  buildingRegsPerUnit: number | null;
  planningProvisional: number | null;
  country: string | null;
  priceDetail: string;
  cilDetail: string;
  s106Detail: string;
  siteDetail: string;
  buildDetail: string;
}

export interface SheetCell {
  section: string;
  cell: string;
  label: string;
  amount: number | null;
  text: string | null;
  detail: string;
}

export interface SheetView {
  cells: SheetCell[];
  blankCells: string[];
  conclusion: string;
}

function cell(
  section: string,
  ref: string,
  label: string,
  detail: string,
  amount: number | null = null,
  text: string | null = null,
): SheetCell {
  return { section, cell: ref, label, amount, text, detail };
}

function filled(row: SheetCell): boolean {
  return row.amount != null || (row.text != null && row.text.length > 0);
}

export function quoteView(facts: SheetFacts): SheetView {
  const typeLabel = houseTypeLabel(facts.houseType);
  const gifaM2 = facts.units != null && facts.sizeSqft != null ? (facts.units * facts.sizeSqft) / SQFT_PER_M2 : null;
  const gdv = facts.units != null && facts.unitPrice != null ? facts.units * facts.unitPrice : null;
  const planningFee =
    facts.country === "England" && facts.units != null ? planningFeeNewDwellings(facts.units) : null;
  const build =
    facts.buildPerSqft != null && facts.units != null && facts.sizeSqft != null
      ? facts.buildPerSqft * facts.sizeSqft * facts.units
      : null;
  const utilities = facts.utilitiesPerUnit != null && facts.units != null ? facts.utilitiesPerUnit * facts.units : null;
  const construction = build != null && utilities != null ? build + utilities : null;
  const cil =
    facts.cilRatePerM2 != null && facts.existingBuildingM2 != null && gifaM2 != null
      ? (gifaM2 - facts.existingBuildingM2) * facts.cilRatePerM2
      : null;

  const cells: SheetCell[] = [
    cell("Site", "Base B2", "Address", "Entered for this land. The workbook leaves this cell blank until a site is named.", null, facts.address),
    cell("Site", "Postcode", "Postcode", facts.authorityName ? `Local authority: ${facts.authorityName}.` : "Local authority was not resolved.", null, facts.postcode),
    cell(
      "Revenue",
      "House type 1",
      "House type",
      "The type you chose. Land Registry sales and the build-cost line are limited to this type.",
      null,
      typeLabel,
    ),
    cell(
      "Revenue",
      "Comparables C13",
      "Units",
      facts.units == null
        ? "No SHLAA, HELAA, or planning page states how many homes this address can take. The count is not assumed."
        : "Count stated for this address.",
      facts.units,
    ),
    cell(
      "Revenue",
      "Base E13",
      "Floor area per home",
      facts.sizeSqft == null
        ? "Price Paid does not publish floor area, and no council page stated one for this address."
        : `${facts.sizeSqft} sq ft.`,
      null,
      facts.sizeSqft == null ? null : `${facts.sizeSqft.toLocaleString("en-GB")} sq ft`,
    ),
    cell(
      "Revenue",
      "Comparables F27",
      `Unit price (${typeLabel})`,
      facts.priceDetail,
      facts.unitPrice,
    ),
    cell(
      "Revenue",
      "GDV",
      "Gross development value",
      gdv == null
        ? "Price × units. Blank because Comparables C13, Comparables F27, or both are blank."
        : "Comparables F27 × Comparables C13. Other house types are not in the sum.",
      gdv,
    ),
    cell(
      "Revenue",
      "Comparables C14:C16, F28:F30",
      "House types 2–4",
      "Blank. They are not the selected house type, so no second mix is filled in.",
    ),
    cell(
      "Revenue",
      "Comparables C8:C9",
      "Affordable units",
      "Blank. Tenure was not stated, so the affordable price stays blank.",
    ),
    cell("Contributions", "Fact Find B3", "CIL rate", facts.cilDetail, facts.cilRatePerM2),
    cell(
      "Contributions",
      "Fact Find B2",
      "Existing building",
      facts.existingBuildingM2 == null
        ? "Blank. Existing floorspace was not published, and it is not assumed to be zero."
        : "Existing floorspace stated for this address.",
      facts.existingBuildingM2,
      facts.existingBuildingM2 == null ? null : `${facts.existingBuildingM2} m²`,
    ),
    cell(
      "Contributions",
      "CIL charge",
      "CIL",
      cil == null
        ? "Blank. The charge needs Fact Find B3, Fact Find B2, and Base E13. A missing part is not treated as zero."
        : "Open-market floor area minus existing floorspace, times the rate. Uses 10.764 sq ft per m².",
      cil,
    ),
    cell("Contributions", "Base S106", "Section 106", facts.s106Detail, facts.s106),
    cell("Construction", "Build rate", `Build cost £/sq ft (${typeLabel})`, facts.buildDetail, facts.buildPerSqft),
    cell(
      "Construction",
      "Build cost",
      "Build cost",
      build == null
        ? "Blank. Needs the selected type’s £/sq ft, Base E13, and Comparables C13."
        : "Rate × floor area × units, for the selected house type only.",
      build,
    ),
    cell(
      "Construction",
      "Utilities",
      "Utilities",
      facts.utilitiesPerUnit == null
        ? "Blank. No published per-dwelling utilities figure for this house type."
        : "Per dwelling × Comparables C13.",
      utilities,
    ),
    cell(
      "Construction",
      "Construction",
      "Construction",
      "Build cost plus utilities. Blank if either part is blank.",
      construction,
    ),
    cell(
      "Fees",
      "Professional fees",
      "Professional fees",
      "Template rates: architect 0.75%, engineer 0.5%, employer’s agent 2.5%, project manager 2% of construction plus 10% contingency. The pounds stay blank while construction is blank.",
    ),
    cell(
      "Fees",
      "Warranty",
      "Warranty",
      facts.warrantyPerUnit == null
        ? "Blank. No published per-dwelling warranty for this house type."
        : "Per dwelling × units.",
      facts.warrantyPerUnit != null && facts.units != null ? facts.warrantyPerUnit * facts.units : null,
    ),
    cell(
      "Fees",
      "Building regulations",
      "Building regulations",
      facts.buildingRegsPerUnit == null
        ? "Blank. No published per-dwelling building-regulations fee for this house type."
        : "Per dwelling × units.",
      facts.buildingRegsPerUnit != null && facts.units != null ? facts.buildingRegsPerUnit * facts.units : null,
    ),
    cell(
      "Fees",
      "Base J23",
      "Planning application fee",
      facts.units == null
        ? "Blank because Comparables C13 is blank. The England schedule from 1 April 2026 is £610 per new dwelling under 10 homes and £659 each for 10 to 50. It is not applied to an assumed count."
        : facts.country === "England"
          ? "England fee for new dwellinghouses from 1 April 2026, times Comparables C13."
          : "Blank. That schedule is for England.",
      planningFee,
    ),
    cell(
      "Fees",
      "Base L22",
      "Planning provisional sum",
      facts.planningProvisional == null
        ? "Blank. The template’s typed provisional sum is not a published fee for this land."
        : "Stated for this land.",
      facts.planningProvisional,
    ),
    cell(
      "Fees",
      "Estate agency",
      "Estate agency",
      gdv == null
        ? "Template rate 1.25% of GDV. Blank because GDV is blank."
        : "Template rate 1.25% of GDV, not a quoted agency fee.",
      gdv == null ? null : gdv * 0.0125,
    ),
    cell(
      "Result",
      "Base C93",
      "Profit target",
      "The template’s target is 20% of GDV. Profit in pounds is not calculated while GDV or the cost cells are blank.",
      null,
      "20% of GDV",
    ),
    cell(
      "Result",
      "Base O89",
      "Profit",
      "GDV minus total costs. Blank while GDV or a cost cell is blank. A blank cost is not treated as zero.",
    ),
    cell(
      "Result",
      "Base C94",
      "Residual land value",
      "GDV × (1 − 20%) minus costs, adding back the land block and 1.25% of GDV. Withheld while a cost or GDV input is blank.",
    ),
  ];

  const blankCells = cells.filter((row) => !filled(row)).map((row) => row.cell);
  const conclusion = [
    `${facts.address}, ${facts.postcode}. House type: ${typeLabel}.`,
    facts.siteDetail,
    facts.cilDetail,
    facts.s106Detail,
    `No residual is stated in Base C94. A 20% profit on GDV is not confirmed. These cells are blank: ${blankCells.join("; ")}.`,
  ].join(" ");

  return { cells, blankCells, conclusion };
}

export function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export { SQFT_PER_M2 };
