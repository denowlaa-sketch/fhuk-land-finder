import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appraise,
  monthlySpendShares,
  npvOfRent,
  planningFeeNewDwellings,
  sdltHigherResidential,
  sdltNonResidentialPremium,
  sdltOnNonResidentialRentNpv,
  sdltOnResidentialRentNpv,
  sdltWorkbookLegacyHigher,
  tentWeights,
} from "./calculate";
import { liveInputs, workbookInputs } from "./scenarios";

test("workbook GDV is 8 x £237,500 plus 1 x £280,000", () => {
  const result = appraise(workbookInputs);
  assert.equal(result.gdv, 2_180_000);
  assert.equal(result.units, 9);
  assert.equal(result.gifaSqft, 8_200);
  assert.equal(result.residualLandValue != null, true);
});

test("workbook cost stack follows the sheet, including the hardcoded agency add-back", () => {
  const result = appraise(workbookInputs);
  const openMarketM2 = (900 / 10.764) * 8 + 1000 / 10.764;
  assert.equal(result.costs.cil, openMarketM2 * 143.45);
  assert.equal(result.costs.utilities, 5_500 * 9);
  assert.equal(result.costs.build, 149 * 7_200 + 203 * 1_000);
  assert.equal(result.costs.contingency, result.costs.construction * 0.1);
  assert.equal(result.costs.omittedFees, 35_000);
  assert.equal(result.profit, result.gdv - result.costs.total);
  const expectedResidual =
    result.gdv * 0.8 - (result.costs.total - result.costs.landAcquisition - result.gdv * 0.0125);
  assert.equal(result.residualLandValue, expectedResidual);
  assert.ok(result.residualLandValue != null && result.residualLandValue < 0);
});

test("the sheet Normal curve is a tent that sums to the whole construction bundle", () => {
  const weights = tentWeights(20);
  assert.equal(
    weights.reduce((total, weight) => total + weight, 0),
    110,
  );
  const shares = monthlySpendShares(1, 21, "Normal");
  const sum = shares.reduce((total, share) => total + share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  const result = appraise(workbookInputs);
  assert.ok(result.cashflow);
  const drawn = result.cashflow.monthlyConstructionShare.reduce(
    (total, share) => total + share * result.cashflow!.constructionBundle,
    0,
  );
  assert.ok(Math.abs(drawn - result.cashflow.constructionBundle) < 1e-6);
  assert.equal(result.cashflow.durationMonths, 20);
  assert.ok(result.cashflow.feesDrawn > result.costs.professionalFees);
});

test("published SDLT examples", () => {
  assert.equal(sdltHigherResidential(300_000, false), 20_000);
  assert.equal(sdltHigherResidential(250_000, false), 15_000);
  assert.equal(sdltWorkbookLegacyHigher(250_000, false), 12_500);
  assert.equal(sdltNonResidentialPremium(275_000), 3_250);
  assert.equal(sdltOnResidentialRentNpv(260_000), 1_350);
  const npv = npvOfRent(200_000, 20, 0.035);
  assert.ok(npv > 150_000 && npv < 5_000_000);
  assert.equal(sdltOnNonResidentialRentNpv(npv), (npv - 150_000) * 0.01);
});

test("planning fee for nine dwellings is £610 each", () => {
  assert.equal(planningFeeNewDwellings(9), 5_490);
  assert.equal(liveInputs.planningApplicationFee, 5_490);
});

test("live sale prices are the matched Price Paid averages and the residual is withheld", () => {
  const result = appraise(liveInputs);
  assert.equal(result.gdvComplete, true);
  assert.equal(result.inputs.openMarket[0].finalPrice, (275_000 + 260_000 + 265_000) / 3);
  assert.equal(
    result.inputs.openMarket[1].finalPrice,
    (330_000 + 315_000 + 362_500 + 249_950) / 4,
  );
  assert.equal(result.residualLandValue, null);
  assert.ok(result.blockers.some((blocker) => blocker.includes("Build cost")));
  assert.equal(result.cashflow, null);
});
