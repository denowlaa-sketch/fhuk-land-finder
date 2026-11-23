import assert from "node:assert/strict";
import test from "node:test";
import { describeCouncil } from "./councilNotes";
import { HESKETH_SCHEME, quoteView } from "./quoteView";
import { normalizePostcode, postcodeSector } from "./lookupPostcode";

const emptyFacts = {
  semiPrice: 250_000 as number | null,
  detachedPrice: 300_000 as number | null,
  cilRatePerM2: null as number | null,
  existingBuildingM2: null as number | null,
  s106: null as number | null,
  buildSemiPerSqft: null as number | null,
  buildDetachedPerSqft: null as number | null,
  utilitiesPerUnit: null as number | null,
  warrantyPerUnit: null as number | null,
  buildingRegsPerUnit: null as number | null,
  planningProvisional: null as number | null,
  country: "England",
  siteSentence: "This postcode is not on a published site.",
  cilSentence: "No single rate.",
  s106Sentence: "No tariff.",
};

test("a blank build cost is not turned into a residual", () => {
  const view = quoteView(HESKETH_SCHEME, emptyFacts);
  assert.equal(view.gdv, 8 * 250_000 + 300_000);
  assert.equal(view.residual, null);
  assert.equal(view.lines.find((row) => row.id === "construction")?.amount, null);
  assert.equal(view.lines.find((row) => row.id === "build")?.amount, null);
  assert.equal(view.lines.find((row) => row.id === "cil")?.amount, null);
  assert.equal(view.lines.find((row) => row.id === "s106")?.amount, null);
  assert.equal(view.lines.find((row) => row.id === "planning")?.amount, 5_490);
  assert.match(view.conclusion, /not on a published site/i);
  assert.match(view.conclusion, /not confirmed/i);
  assert.ok(view.missing.includes("build cost"));
});

test("a known CIL rate still needs existing floorspace", () => {
  const view = quoteView(HESKETH_SCHEME, { ...emptyFacts, cilRatePerM2: 143.45 });
  assert.equal(view.lines.find((row) => row.id === "cil")?.amount, null);
  assert.ok(view.missing.includes("existing building floorspace"));
});

test("West Lancashire notes do not apply a zone rate or a legal fee as Section 106", () => {
  const notes = describeCouncil({
    postcode: "PR4 6AP",
    authorityName: "West Lancashire Borough Council",
    gss: "E07000127",
    website: "https://www.westlancs.gov.uk",
    websiteStatus: 200,
    cilDocuments: [],
    sites: [],
  });
  assert.equal(notes.cilRatePerM2, null);
  assert.equal(notes.s106Amount, null);
  assert.equal(notes.onPublishedSite, false);
  assert.match(notes.siteSummary, /not on a published SHELAA site/);
  assert.match(notes.siteSummary, /PR4 6AT/);
  assert.match(notes.cilSummary, /143\.45/);
  assert.match(notes.cilSummary, /not applied|no CIL rate is applied/i);
  assert.match(notes.s106Summary, /1,307\.59/);
  assert.match(notes.s106Summary, /not entered as the Section 106 contribution/);
});

test("a council outside West Lancashire does not inherit the £143.45 rate", () => {
  const notes = describeCouncil({
    postcode: "M1 1AE",
    authorityName: "Manchester City Council",
    gss: "E08000003",
    website: "https://www.manchester.gov.uk",
    websiteStatus: 403,
    cilDocuments: [],
    sites: [],
  });
  assert.equal(notes.cilRatePerM2, null);
  assert.equal(notes.s106Amount, null);
  assert.equal(notes.onPublishedSite, false);
  assert.match(notes.cilSummary, /no community infrastructure levy/i);
  assert.match(notes.cilSummary, /143\.45/);
  assert.match(notes.siteSummary, /not on a published housing site/i);
  assert.match(notes.siteSummary, /403/);
});

test("postcode sector is the outward code plus the first inward digit", () => {
  assert.equal(normalizePostcode("pr46ap"), "PR4 6AP");
  assert.equal(postcodeSector("PR4 6AP"), "PR4 6");
  assert.equal(postcodeSector("M1 1AE"), "M1 1");
  assert.equal(normalizePostcode("not a postcode"), null);
});
