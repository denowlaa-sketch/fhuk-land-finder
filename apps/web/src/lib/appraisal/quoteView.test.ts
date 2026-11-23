import assert from "node:assert/strict";
import test from "node:test";
import { describeCouncil } from "./councilNotes";
import { normalizePostcode, postcodeSector } from "./lookupPostcode";
import { emptySheet, evaluateSheet } from "./sheetCalc";
import type { PostcodeLookup } from "./lookupPostcode";

function row(id: string, inputs = emptySheet(), lookup: PostcodeLookup | null = null) {
  return evaluateSheet(inputs, lookup).rows.find((item) => item.id === id);
}

test("an empty sheet does not assume a unit mix or a residual", () => {
  const view = evaluateSheet(emptySheet(), null);
  assert.equal(row("gdv", emptySheet())?.result, "");
  assert.equal(row("j58")?.result, "");
  assert.equal(row("c94")?.result, "");
  assert.match(row("c94")?.note ?? "", /J38 Section 106/);
  assert.match(row("c94")?.note ?? "", /J58:J61 build cost/);
  assert.equal(emptySheet().ht1Units, "");
  assert.equal(emptySheet().ht2Units, "");
  assert.doesNotMatch(view.rows.map((item) => item.note).join(" "), /8 semi/i);
});

test("a unit price without a count does not produce GDV", () => {
  const inputs = { ...emptySheet(), houseType: "terraced" as const, ht1Price: "250000" };
  assert.equal(row("gdv", inputs)?.result, "");
  assert.equal(row("j23", inputs)?.result, "");
});

test("the planning fee uses the typed unit count, not a fixed nine homes", () => {
  const inputs = { ...emptySheet(), ht1Units: "4", ht1Sqft: "800", ht1Price: "200000" };
  const lookup = { country: "England" } as PostcodeLookup;
  assert.equal(row("gdv", inputs, lookup)?.result, "£800,000.00");
  assert.equal(row("j23", inputs, lookup)?.result, "£2,440.00");
});

test("a typed CIL rate still needs existing floorspace and a floor area", () => {
  const inputs = { ...emptySheet(), cilRate: "100", ht1Units: "1", ht1Price: "100000" };
  assert.equal(row("j39", inputs)?.result, "");
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
  assert.match(notes.siteSummary, /manchester\.gov\.uk returned 403/);
});

test("postcode sector is the outward code plus the first inward digit", () => {
  assert.equal(normalizePostcode("pr46ap"), "PR4 6AP");
  assert.equal(postcodeSector("PR4 6AP"), "PR4 6");
  assert.equal(postcodeSector("M1 1AE"), "M1 1");
  assert.equal(normalizePostcode("not a postcode"), null);
});
