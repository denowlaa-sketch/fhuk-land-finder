"use client";

import { FormEvent, useMemo, useState } from "react";
import type { PostcodeLookup } from "@/lib/appraisal/lookupPostcode";
import { emptySheet, evaluateSheet, type SheetInputs } from "@/lib/appraisal/sheetCalc";
import { HOUSE_TYPES, houseTypeLabel, type HouseType } from "@/lib/appraisal/quoteView";

const TYPE_ROWS: { label: string; units: keyof SheetInputs; sqft: keyof SheetInputs; price: keyof SheetInputs; build: keyof SheetInputs }[] = [
  { label: "Affordable 1", units: "aff1Units", sqft: "aff1Sqft", price: "aff1Price", build: "aff1Build" },
  { label: "Affordable 2", units: "aff2Units", sqft: "aff2Sqft", price: "aff2Price", build: "aff2Build" },
  { label: "House type 1", units: "ht1Units", sqft: "ht1Sqft", price: "ht1Price", build: "ht1Build" },
  { label: "House type 2", units: "ht2Units", sqft: "ht2Sqft", price: "ht2Price", build: "ht2Build" },
  { label: "House type 3", units: "ht3Units", sqft: "ht3Sqft", price: "ht3Price", build: "ht3Build" },
  { label: "House type 4", units: "ht4Units", sqft: "ht4Sqft", price: "ht4Price", build: "ht4Build" },
];

function Field({
  value,
  onChange,
  label,
  wide,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  wide?: boolean;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 ${wide ? "w-full" : "w-28"}`}
    />
  );
}

export function PostcodeAppraisal() {
  const [inputs, setInputs] = useState<SheetInputs>(emptySheet());
  const [lookup, setLookup] = useState<PostcodeLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const view = useMemo(() => evaluateSheet(inputs, lookup), [inputs, lookup]);

  function set<K extends keyof SheetInputs>(key: K, value: SheetInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        postcode: inputs.postcode,
        address: inputs.address,
        houseType: inputs.houseType,
      });
      const response = await fetch(`/api/appraisal?${params.toString()}`);
      const payload = (await response.json()) as PostcodeLookup & { error?: string };
      if (!response.ok) {
        setLookup(null);
        setError(payload.error || "The lookup failed.");
        return;
      }
      setLookup(payload);
      setInputs((current) => ({
        ...current,
        ht1Price:
          current.ht1Price.trim() === "" && payload.unitPrice != null
            ? String(Math.round(payload.unitPrice * 100) / 100)
            : current.ht1Price,
      }));
    } catch {
      setLookup(null);
      setError("The lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  const typeLabel = inputs.houseType ? houseTypeLabel(inputs.houseType) : "House type 1";

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700 sm:col-span-2">
          Land address
          <input
            value={inputs.address}
            onChange={(event) => set("address", event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="text-sm text-slate-700">
          Postcode
          <input
            value={inputs.postcode}
            onChange={(event) => set("postcode", event.target.value)}
            className="mt-1 block w-40 rounded-md border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="text-sm text-slate-700">
          House type
          <select
            value={inputs.houseType}
            onChange={(event) => set("houseType", event.target.value as HouseType | "")}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            required
          >
            <option value="">Choose a type</option>
            {HOUSE_TYPES.map((type) => (
              <option key={type} value={type}>
                {houseTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Looking up…" : "Look up sources"}
          </button>
        </div>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="px-3 py-2 text-left text-sm font-medium text-slate-900">
            Accommodation. House type 1 is the type you chose. The other rows stay empty until you type them.
          </caption>
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Units</th>
              <th className="px-3 py-2 font-medium">Sq ft</th>
              <th className="px-3 py-2 font-medium">Unit price</th>
              <th className="px-3 py-2 font-medium">Build £/sq ft</th>
            </tr>
          </thead>
          <tbody>
            {TYPE_ROWS.map((type) => (
              <tr key={type.units} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {type.units === "ht1Units" ? typeLabel : type.label}
                </td>
                <td className="px-3 py-2">
                  <Field label={`${type.label} units`} value={inputs[type.units]} onChange={(value) => set(type.units, value)} />
                </td>
                <td className="px-3 py-2">
                  <Field label={`${type.label} square feet`} value={inputs[type.sqft]} onChange={(value) => set(type.sqft, value)} />
                </td>
                <td className="px-3 py-2">
                  <Field label={`${type.label} price`} value={inputs[type.price]} onChange={(value) => set(type.price, value)} />
                </td>
                <td className="px-3 py-2">
                  <Field label={`${type.label} build rate`} value={inputs[type.build]} onChange={(value) => set(type.build, value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="px-3 py-2 text-left text-sm font-medium text-slate-900">
            Base Financial Appraisal. Type the input cells. Calculated cells stay blank while a cost is empty.
          </caption>
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Row</th>
              <th className="px-3 py-2 font-medium">Cell</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {view.rows
              .filter((item) => !["aff", "ht1", "e13", "f27", "ht2", "ht3", "ht4"].includes(item.id))
              .map((item) =>
                item.mode === "section" ? (
                  <tr key={item.id} className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-3 py-2 font-medium text-slate-900">
                      {item.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-medium text-slate-900">{item.label}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{item.cell}</td>
                    <td className="px-3 py-2">
                      {item.inputKey && item.id !== "b2" && item.id !== "pc" && item.id !== "type" ? (
                        <Field
                          wide
                          label={item.label}
                          value={inputs[item.inputKey]}
                          onChange={(value) => set(item.inputKey!, value)}
                        />
                      ) : (
                        <span>{item.result || "Blank"}</span>
                      )}
                      {item.inputKey && item.result ? (
                        <div className="mt-1 text-slate-700">{item.result}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.note}</td>
                  </tr>
                ),
              )}
          </tbody>
        </table>
      </div>

      {lookup ? (
        <section>
          <h2 className="text-sm font-medium text-slate-900">
            {lookup.houseType} sales for {lookup.address}
          </h2>
          {lookup.salesError ? <p className="mt-1 text-sm text-red-700">{lookup.salesError}</p> : null}
          {lookup.sales.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">No standard sales of this house type in the sample.</p>
          ) : (
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Address</th>
                  <th className="py-1 pr-3 font-medium">Price</th>
                  <th className="py-1 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {lookup.sales.map((sale) => (
                  <tr key={`${sale.address}-${sale.date}-${sale.price}`} className="border-t border-slate-100">
                    <td className="py-1 pr-3">
                      {sale.address}
                      {sale.onThisAddress ? " · this address" : ""}
                    </td>
                    <td className="py-1 pr-3">{sale.price.toLocaleString("en-GB", { style: "currency", currency: "GBP" })}</td>
                    <td className="py-1">{sale.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="mt-3 space-y-2 text-sm">
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
      ) : null}
    </div>
  );
}
