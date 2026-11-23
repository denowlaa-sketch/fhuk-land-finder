import { PageHeader } from "@/components/PageHeader";
import { appraise, sdltHigherResidential, sdltWorkbookLegacyHigher } from "@/lib/appraisal/calculate";
import {
  RETRIEVED_ON,
  confirmedSales,
  liveInputs,
  modelAssumptions,
  unmatchedSheetComps,
  workbookInputs,
} from "@/lib/appraisal/scenarios";
import type { AppraisalResult } from "@/lib/appraisal/calculate";

export const dynamic = "force-static";

const SOURCES = [
  {
    label: "HM Land Registry Price Paid Data",
    url: "https://landregistry.data.gov.uk/landregistry/query",
    value: "Matched sold prices in the table below",
  },
  {
    label: "West Lancashire CIL annual rate summary 2026",
    url: "https://www.westlancs.gov.uk/media/548513/2026-cil-rate-summary.pdf",
    value: "Residential dwellings £143.45/m² in Zone A, £0 in Zone B",
  },
  {
    label: "Planning fees in England from 1 April 2026",
    url: "https://assets.publishing.service.gov.uk/media/69a073bb07d7bff3604d6df6/Planning_fees_-_annual_indexation_from_1_April_2026.pdf",
    value: "£610 per new dwelling where fewer than 10 are created (£5,490 for 9)",
  },
  {
    label: "Higher rates of Stamp Duty Land Tax",
    url: "https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property",
    value: "From 1 April 2025: 5%, 7%, 10%, 15%, 17%. Worked example £300,000 = £20,000",
  },
  {
    label: "Non-residential and mixed SDLT",
    url: "https://www.gov.uk/stamp-duty-land-tax/nonresidential-and-mixed-rates",
    value: "Premium 0% / 2% / 5%. Rent NPV 0% / 1% / 2%",
  },
  {
    label: "Residential leasehold SDLT",
    url: "https://www.gov.uk/guidance/stamp-duty-land-tax-leasehold-purchases",
    value: "1% of rent NPV above £125,000. Worked example £260,000 NPV = £1,350",
  },
  {
    label: "Bank of England Bank Rate",
    url: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp",
    value: "4% from 5 November 2026. Not used as the facility rate",
  },
];

function gbp(value: number): string {
  const whole = Math.abs(value - Math.round(value)) < 0.005;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 2 : 2,
  }).format(value);
}

function pct(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export default function AppraisalPage() {
  const workbook = appraise(workbookInputs);
  const live = appraise(liveInputs);
  const legacyStamp = sdltWorkbookLegacyHigher(250_000, false);
  const currentStamp = sdltHigherResidential(250_000, false);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Hesketh appraisal"
        description="Replica of BuildUp Master Basic Appraisal Hesketh. The residual is the land quote at a 20% profit on GDV. Sale prices dated below were read from HM Land Registry Price Paid Data on 23 November 2026."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <QuoteCard
          eyebrow="Spreadsheet inputs"
          title="Residual land value"
          result={workbook}
          detail="Uses the prices and cost rates typed in the workbook, including £149/sq ft and £203/sq ft. Those build rates were not refreshed."
        />
        <QuoteCard
          eyebrow="Public sources"
          title="Sales GDV"
          result={live}
          detail="Unit prices are the unweighted average of the Price Paid records that match the workbook comps. The residual is withheld because build cost, Section 106 and several fee lines have no public figure."
        />
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-slate-900">Workbook cost stack</h2>
        <p className="mt-1 text-sm text-slate-600">
          Same additions as column O on Base Financial Appraisal. Adoption fees, insurance bonds
          and associated legal fees are calculated on the sheet and then left out of the total.
        </p>
        <table className="mt-4 w-full text-sm">
          <tbody>
            <CostRow label="Gross development value" value={workbook.gdv} />
            <CostRow label="Planning (provisional sum only)" value={workbook.costs.planning} />
            <CostRow label="Section 106" value={workbook.costs.s106} />
            <CostRow label="CIL on open-market GIFA" value={workbook.costs.cil} />
            <CostRow label="Utilities" value={workbook.costs.utilities} />
            <CostRow label="Build cost" value={workbook.costs.build} />
            <CostRow label="Contingency at 10% of construction" value={workbook.costs.contingency} />
            <CostRow label="Professional fees inside the total" value={workbook.costs.professionalFees} />
            <CostRow label="Sales costs" value={workbook.costs.sales} />
            <CostRow label="Land acquisition lines (stamp duty typed as £12,500)" value={workbook.costs.landAcquisition} />
            <CostRow label="Total costs" value={workbook.costs.total} strong />
            <CostRow label="Profit before finance" value={workbook.profit} />
            <CostRow
              label="Fees on the sheet but outside the total"
              value={workbook.costs.omittedFees}
            />
          </tbody>
        </table>
      </section>

      {workbook.cashflow ? (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">Cashflow</h2>
          <p className="mt-1 text-sm text-slate-600">
            Construction is spread with the sheet&apos;s tent curve over {workbook.cashflow.durationMonths}{" "}
            months (start month 1, end month 21, duration = end minus start). Senior interest below
            is the sheet total, which sums months 1 to 21 only, at 7% on the cumulative draw plus
            the land deficit. Months 3 onward on the other senior row use 10% instead of the 7%
            header. That second row is not the figure shown here.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Senior interest, months 1–21" value={gbp(workbook.cashflow.sheetSeniorInterest)} />
            <Stat label="Same interest over all 24 months" value={gbp(workbook.cashflow.seniorInterestAllMonths)} />
            <Stat label="Equity at 10% of total cost" value={gbp(workbook.cashflow.equityAt10Pct)} />
          </dl>
          <p className="mt-3 text-sm text-slate-600">
            Professional fees are posted as the fee total divided by 21 in months 2 to 24, so the
            cashflow draws {gbp(workbook.cashflow.feesDrawn)} against fees of{" "}
            {gbp(workbook.costs.professionalFees)}. Land is not drawn in month 1 because the
            sheet&apos;s land-payment switch is false.
          </p>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Price Paid records used for the live GDV
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          House type 1 average {gbp(liveInputs.openMarket[0].finalPrice ?? 0)} from three
          semi-detached sales. House type 2 average {gbp(liveInputs.openMarket[1].finalPrice ?? 0)}{" "}
          from four detached sales. The workbook&apos;s own final prices are £237,500 and £280,000,
          which are manual figures, not these averages.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Completed</th>
                <th className="px-3 py-2 font-medium">Used for</th>
              </tr>
            </thead>
            <tbody>
              {confirmedSales.map((sale) => (
                <tr key={`${sale.address}-${sale.date}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {sale.address}
                    <div className="text-xs text-slate-500">{sale.postcode}</div>
                  </td>
                  <td className="px-3 py-2">{sale.propertyType}</td>
                  <td className="px-3 py-2">{gbp(sale.price)}</td>
                  <td className="px-3 py-2">{sale.date}</td>
                  <td className="px-3 py-2">{sale.houseType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-display text-lg font-semibold text-amber-950">Left blank</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
          <li>Site address and planning link. The file name is Hesketh. Zone B CIL would be £0, and the zone was not checked against a map.</li>
          <li>Build cost £/sq ft. The workbook uses £149 and £203. BCIS is a paid source, so those rates were not replaced and are not used in the live residual.</li>
          <li>Section 106 of £45,000, utilities at £5,500 a unit, warranty at £2,500 a unit, and building regulations at £1,500 a unit. No public tariff was fetched.</li>
          <li>The £22,500 planning provisional sum. The statutory fee of £5,490 is filled on the live side only.</li>
          <li>Comparable floor areas. Rightmove returned 403, and Price Paid does not publish floor area.</li>
          {unmatchedSheetComps.map((comp) => (
            <li key={comp.address}>
              {comp.address} at {gbp(comp.sheetPrice)} in the workbook. {comp.reason}
            </li>
          ))}
          <li>
            SDLT on the land itself. The site value is the residual, the workbook types £12,500 by
            hand, and a company buying a dwelling over £500,000 may face the 17% corporate rate
            instead of the banded higher rates. Developer relief is not decided here. On the
            workbook&apos;s own £250,000 Fact Find example, the sheet&apos;s old bands give{" "}
            {gbp(legacyStamp)} and the current higher rates give {gbp(currentStamp)}.
          </li>
          <li>
            The 3.5% rent discount in the Fact Find NPV. The rate bands were checked. The discount
            rate was not stated on the GOV.UK pages retrieved on {RETRIEVED_ON}.
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">Sources retrieved {RETRIEVED_ON}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {SOURCES.map((source) => (
            <li key={source.url} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <a href={source.url} className="font-medium">
                {source.label}
              </a>
              <div className="text-slate-600">{source.value}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 text-sm text-slate-600">
        <h2 className="font-display text-lg font-semibold text-slate-900">Kept from the sheet as settings</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {modelAssumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function QuoteCard({
  eyebrow,
  title,
  result,
  detail,
}: {
  eyebrow: string;
  title: string;
  result: AppraisalResult;
  detail: string;
}) {
  const headline =
    result.residualLandValue == null ? gbp(result.gdv) : gbp(result.residualLandValue);
  const headlineLabel = result.residualLandValue == null ? "GDV only" : title;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">{eyebrow}</div>
      <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">{headlineLabel}</h2>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900">
        {headline}
      </div>
      <p className="mt-2 text-sm text-slate-600">{detail}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-slate-500">GDV</dt>
          <dd className="font-medium">{gbp(result.gdv)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Profit margin</dt>
          <dd className="font-medium">
            {result.residualLandValue == null ? "—" : pct(result.profitMargin)}
          </dd>
        </div>
      </dl>
      {result.blockers.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {result.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-700">
          Pre-finance profit {gbp(result.profit)} ({pct(result.profitMargin)} of GDV). Finance is
          not deducted in this residual, matching the base sheet.
        </p>
      )}
    </section>
  );
}

function CostRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={strong ? "border-t border-slate-200 font-semibold" : "border-t border-slate-100"}>
      <td className="py-2 pr-3">{label}</td>
      <td className="py-2 text-right tabular-nums">{gbp(value)}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}
