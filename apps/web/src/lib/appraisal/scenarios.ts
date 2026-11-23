import {
  planningFeeNewDwellings,
  type AppraisalInputs,
  type HouseTypeInput,
} from "./calculate";

export interface SaleEvidence {
  address: string;
  postcode: string;
  propertyType: string;
  price: number;
  date: string;
  sheetPrice: number | null;
  houseType: "House type 1" | "House type 2";
  usedInLiveAverage: boolean;
  note: string;
}

export const RETRIEVED_ON = "2026-11-23";

export const confirmedSales: SaleEvidence[] = [
  {
    address: "17 Fermor Road",
    postcode: "PR4 6AP",
    propertyType: "semi-detached",
    price: 275_000,
    date: "2026-04-02",
    sheetPrice: 275_000,
    houseType: "House type 1",
    usedInLiveAverage: true,
    note: "Price Paid matches the workbook comp (3-bed semi, sold).",
  },
  {
    address: "37 Sutton Avenue",
    postcode: "PR4 6BA",
    propertyType: "semi-detached",
    price: 260_000,
    date: "2026-04-02",
    sheetPrice: 260_000,
    houseType: "House type 1",
    usedInLiveAverage: true,
    note: "Price Paid matches the workbook comp.",
  },
  {
    address: "99 Moss Lane",
    postcode: "PR4 6AD",
    propertyType: "semi-detached",
    price: 265_000,
    date: "2023-06-12",
    sheetPrice: 265_000,
    houseType: "House type 1",
    usedInLiveAverage: true,
    note: "Exact price and semi-detached type. The sale is from 2023, so it is not a 2026 quote.",
  },
  {
    address: "214 Moss Lane",
    postcode: "PR4 6AE",
    propertyType: "detached",
    price: 330_000,
    date: "2024-03-27",
    sheetPrice: 330_000,
    houseType: "House type 2",
    usedInLiveAverage: true,
    note: "Latest detached Moss Lane sale at the workbook price. 28 Moss Lane also sold at £330,000 on 12 June 2023 and was not added again.",
  },
  {
    address: "28 River View",
    postcode: "PR4 6EQ",
    propertyType: "detached",
    price: 315_000,
    date: "2026-06-23",
    sheetPrice: 315_000,
    houseType: "House type 2",
    usedInLiveAverage: true,
    note: "Workbook links the PR4 6EQ sold-prices page and records £315,000.",
  },
  {
    address: "12 Fairclough Drive",
    postcode: "PR4 6EX",
    propertyType: "detached",
    price: 362_500,
    date: "2026-06-26",
    sheetPrice: 362_500,
    houseType: "House type 2",
    usedInLiveAverage: true,
    note: "Price Paid matches the workbook comp.",
  },
  {
    address: "21 Fairclough Drive",
    postcode: "PR4 6EX",
    propertyType: "detached",
    price: 249_950,
    date: "2024-09-20",
    sheetPrice: 249_950,
    houseType: "House type 2",
    usedInLiveAverage: true,
    note: "Price Paid matches the workbook comp.",
  },
];

export const unmatchedSheetComps: { address: string; sheetPrice: number; reason: string }[] = [
  {
    address: "River View (workbook: 3-bed semi, new build)",
    sheetPrice: 295_000,
    reason:
      "Land Registry has detached River View sales at £295,000 (60 River View, PR4 6EQ, 23 June 2026, and 51 River View, PR4 6ED, 11 December 2025). The type does not match the semi in the sheet, so the price was not used.",
  },
  {
    address: "River View (workbook: 4-bed detached)",
    sheetPrice: 270_000,
    reason:
      "No Price Paid record at £270,000. The nearest recent River View sale in the sample is 21 River View at £270,500 on 6 October 2025. Not used.",
  },
  {
    address: "Station Road, Preston",
    sheetPrice: 242_000,
    reason:
      "The workbook links a Rightmove listing, not a sold-price record, and gives no house number. Rightmove returned 403. Not used.",
  },
];

function average(houseType: SaleEvidence["houseType"]): number | null {
  const sales = confirmedSales.filter(
    (sale) => sale.houseType === houseType && sale.usedInLiveAverage,
  );
  if (sales.length === 0) return null;
  return sales.reduce((total, sale) => total + sale.price, 0) / sales.length;
}

const emptyType = (name: string): HouseTypeInput => ({
  name,
  units: 0,
  sizeSqft: 0,
  finalPrice: 0,
  buildCostPerSqft: 0,
});

const sharedScheme = {
  siteAddress: null,
  affordable: [emptyType("Affordable house type 1"), emptyType("Affordable house type 2")],
  existingBuildingM2: 0,
  contingencyRate: 0.1,
  architectRate: 0.0075,
  engineerRate: 0.005,
  employersAgentRate: 0.025,
  projectManagementRate: 0.02,
  showHome: 0,
  estateAgencyRate: 0.0125,
  advertising: 0,
  brochures: 0,
  siteSalesSign: 0,
  salesLegalPerUnit: 0,
  siteValue: null,
  landLegalRate: 0.02,
  targetProfitOnSale: 0.2,
  seniorHeaderRate: 0.07,
  landDrawnInMonthOne: false,
  buildStartMonth: 1,
  buildEndMonth: 21,
  distMethod: "Normal" as const,
  adoptionFees: 20_000,
  insuranceBonds: 10_000,
  associatedLegalFees: 5_000,
};

function openMarket(
  prices: { ht1: number | null; ht2: number | null },
  build: { ht1: number | null; ht2: number | null },
): HouseTypeInput[] {
  return [
    {
      name: "House type 1",
      units: 8,
      sizeSqft: 900,
      finalPrice: prices.ht1,
      buildCostPerSqft: build.ht1,
    },
    {
      name: "House type 2",
      units: 1,
      sizeSqft: 1000,
      finalPrice: prices.ht2,
      buildCostPerSqft: build.ht2,
    },
    { name: "House type 3", units: 0, sizeSqft: 0, finalPrice: 0, buildCostPerSqft: 0 },
    { name: "House type 4", units: 0, sizeSqft: 0, finalPrice: 0, buildCostPerSqft: 0 },
  ];
}

/** Every figure typed on the workbook, including ones that are not live quotes. */
export const workbookInputs: AppraisalInputs = {
  ...sharedScheme,
  id: "workbook",
  label: "Workbook inputs",
  openMarket: openMarket({ ht1: 237_500, ht2: 280_000 }, { ht1: 149, ht2: 203 }),
  planningProvisional: 22_500,
  planningApplicationFee: null,
  s106: 45_000,
  cilRatePerM2: 143.45,
  utilitiesPerUnit: 5_500,
  warrantyPerUnit: 2_500,
  buildingRegsPerUnit: 1_500,
  stampDutyManual: 12_500,
  residualRequires: [],
};

const liveFee = planningFeeNewDwellings(9);

/** Sale prices from Price Paid. Cost inputs that are not public stay null. */
export const liveInputs: AppraisalInputs = {
  ...sharedScheme,
  id: "live",
  label: "Live-sourced inputs",
  openMarket: openMarket(
    { ht1: average("House type 1"), ht2: average("House type 2") },
    { ht1: null, ht2: null },
  ),
  planningProvisional: null,
  planningApplicationFee: liveFee,
  s106: null,
  cilRatePerM2: null,
  utilitiesPerUnit: null,
  warrantyPerUnit: null,
  buildingRegsPerUnit: null,
  stampDutyManual: null,
  adoptionFees: null,
  insuranceBonds: null,
  associatedLegalFees: null,
  residualRequires: [
    "house-prices",
    "build-rates",
    "s106",
    "cilRatePerM2",
    "utilitiesPerUnit",
    "warrantyPerUnit",
    "buildingRegsPerUnit",
    "planningProvisional",
  ],
};

export const modelAssumptions = [
  "Unit counts and proposed sizes (8 × 900 sq ft and 1 × 1,000 sq ft) are the scheme on the sheet, not a market feed.",
  "Target profit 20%, contingency 10%, and the professional-fee percentages are appraiser settings.",
  "Senior debt is modelled at 7% on the cleaner cashflow row. That is not Bank Rate.",
  "The 1% land-introduction rate has no amount formula, so it adds nothing.",
  "Affordable units are zero. No affordable price was fetched.",
];
