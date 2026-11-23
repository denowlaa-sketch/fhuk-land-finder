"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatGbp, HESKETH_SCHEME, quoteView, type Scheme } from "@/lib/appraisal/quoteView";
import type { PostcodeLookup, Sale } from "@/lib/appraisal/lookupPostcode";

function shown(amount: number | null, text: string | null): string {
  if (text) return text;
  if (amount == null) return "Not filled";
  return formatGbp(amount);
}

function SaleTable({ title, sales, average }: { title: string; sales: Sale[]; average: number | null }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-900">
        {title}
        {average != null ? ` · average ${formatGbp(average)}` : " · no sales in this sample"}
      </h3>
      {sales.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">None in the latest matching records.</p>
      ) : (
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Address</th>
              <th className="py-1 pr-3 font-medium">Postcode</th>
              <th className="py-1 pr-3 font-medium">Price</th>
              <th className="py-1 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={`${sale.address}-${sale.date}-${sale.price}`} className="border-t border-slate-100">
                <td className="py-1 pr-3">{sale.address}</td>
                <td className="py-1 pr-3">{sale.postcode}</td>
                <td className="py-1 pr-3">{formatGbp(sale.price)}</td>
                <td className="py-1">{sale.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function PostcodeAppraisal() {
  const [postcode, setPostcode] = useState("PR4 6AP");
  const [scheme, setScheme] = useState<Scheme>(HESKETH_SCHEME);
  const [lookup, setLookup] = useState<PostcodeLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const view = useMemo(() => {
    if (!lookup) return null;
    return quoteView(scheme, {
      semiPrice: lookup.semiPrice,
      detachedPrice: lookup.detachedPrice,
      cilRatePerM2: lookup.cilRatePerM2,
      existingBuildingM2: null,
      s106: lookup.s106Amount,
      buildSemiPerSqft: null,
      buildDetachedPerSqft: null,
      utilitiesPerUnit: null,
      warrantyPerUnit: null,
      buildingRegsPerUnit: null,
      planningProvisional: null,
      country: lookup.country,
      siteSentence: lookup.siteSummary,
      cilSentence: lookup.cilSummary,
      s106Sentence: lookup.s106Summary,
    });
  }, [lookup, scheme]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/appraisal?postcode=${encodeURIComponent(postcode)}`);
      const payload = (await response.json()) as PostcodeLookup & { error?: string };
      if (!response.ok) {
        setLookup(null);
        setError(payload.error || "The lookup failed.");
        return;
      }
      setLookup(payload);
    } catch {
      setLookup(null);
      setError("The lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function setNumber(key: keyof Scheme, value: string, integer: boolean) {
    const parsed = integer ? Number.parseInt(value, 10) : Number(value);
    setScheme((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block text-sm text-slate-700">
          UK postcode
          <input
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            className="mt-1 block w-48 rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            autoComplete="postal-code"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Looking up…" : "Look up"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-900">Assumptions</legend>
        <p className="mb-3 text-sm text-slate-600">
          The unit mix, floor areas, and {Math.round(scheme.targetProfit * 100)}% profit target start as the
          Hesketh workbook default. They are not taken from the postcode. Change them and the results update.
          Affordable units stay at zero.
        </p>
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="text-sm text-slate-700">
            Semi units
            <input
              type="number"
              min={0}
              value={scheme.semiUnits}
              onChange={(event) => setNumber("semiUnits", event.target.value, true)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-700">
            Semi sq ft
            <input
              type="number"
              min={0}
              value={scheme.semiSqft}
              onChange={(event) => setNumber("semiSqft", event.target.value, false)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-700">
            Detached units
            <input
              type="number"
              min={0}
              value={scheme.detachedUnits}
              onChange={(event) => setNumber("detachedUnits", event.target.value, true)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-700">
            Detached sq ft
            <input
              type="number"
              min={0}
              value={scheme.detachedSqft}
              onChange={(event) => setNumber("detachedSqft", event.target.value, false)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="text-sm text-slate-700">
            Profit target %
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(scheme.targetProfit * 100)}
              onChange={(event) =>
                setScheme((current) => ({
                  ...current,
                  targetProfit: (Number(event.target.value) || 0) / 100,
                }))
              }
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
      </fieldset>

      {lookup && view ? (
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 p-4">
            <h2 className="text-lg font-medium text-slate-900">{lookup.postcode}</h2>
            <p className="mt-1 text-sm text-slate-700">
              {lookup.authorityName}
              {lookup.lpaName ? ` · ${lookup.lpaName}` : ""}
              {lookup.parish ? ` · ${lookup.parish}` : ""}
              {lookup.ward ? ` · ${lookup.ward}` : ""}
              {lookup.builtUpArea ? ` · ${lookup.builtUpArea}` : ""}
              {lookup.country ? ` · ${lookup.country}` : ""}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-800">{view.conclusion}</p>
            <p className="mt-2 text-sm text-slate-600">{lookup.buildSummary}</p>
          </section>

          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 font-medium">Value</th>
                <th className="py-2 font-medium">Where it comes from</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3 font-medium text-slate-900">{row.label}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{shown(row.amount, row.text)}</td>
                  <td className="py-2 text-slate-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {lookup.salesError ? <p className="text-sm text-red-700">{lookup.salesError}</p> : null}
          <SaleTable title="Semi-detached sales" sales={lookup.semis} average={lookup.semiPrice} />
          <SaleTable title="Detached sales" sales={lookup.detached} average={lookup.detachedPrice} />

          <section>
            <h2 className="text-sm font-medium text-slate-900">Sources</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {lookup.citations.map((citation) => (
                <li key={citation.url + citation.label}>
                  <a href={citation.url} className="text-sky-800 underline" target="_blank" rel="noreferrer">
                    {citation.label}
                  </a>
                  <span className="text-slate-600">
                    {" "}
                    · {citation.date} · {citation.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
