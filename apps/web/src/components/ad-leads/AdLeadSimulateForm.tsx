"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdChannel } from "@/lib/ad-leads/channels";

const DEFAULTS = {
  full_name: "Alex Seller",
  phone_number: "07123 456789",
  email: "alex@example.com",
  location: "Stockport, Greater Manchester",
  plot_size: "0.25 acres",
  tenure: "freehold",
  planning: "none",
  price_expectation: "250000",
  timeline: "within_3_months",
  motivation: "Downsizing — cash sale preferred",
  ownership_interest: "yes",
  consent_to_call: "yes",
};

export function AdLeadSimulateForm({
  channel,
}: {
  channel: Exclude<AdChannel, never>;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const endpoint =
    channel === "tiktok"
      ? "/api/tiktok/leads/simulate"
      : "/api/facebook/leads/simulate";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body =
        channel === "tiktok"
          ? { ...fields }
          : { ...fields, channel, platform: channel };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(
        `${data.created ? "Created" : "Updated"} ${data.lead.ref} — score ${data.qualify.score}, consent=${data.answers.consentToCall}, channel=${data.lead.ad_channel || channel}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const title =
    channel === "tiktok"
      ? "Simulate TikTok Lead Gen"
      : channel === "instagram"
        ? "Simulate Instagram Instant Form"
        : "Simulate Facebook Instant Form";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="font-display text-base font-semibold text-slate-900">
        {title}
      </h3>
      <p className="text-xs text-slate-500">
        Consent must be explicit yes for the call queue (PECR). Scoring only —
        no dial or email on ingest.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["full_name", "Full name"],
            ["phone_number", "Phone"],
            ["email", "Email"],
            ["location", "Location"],
            ["plot_size", "Plot size"],
            ["tenure", "Tenure"],
            ["planning", "Planning"],
            ["price_expectation", "Price expectation"],
            ["timeline", "Timeline"],
            ["motivation", "Motivation"],
            ["ownership_interest", "Owner? (yes/no)"],
            ["consent_to_call", "Consent to call (yes/no)"],
          ] as Array<[keyof typeof DEFAULTS, string]>
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </span>
            <input
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              value={fields[key]}
              onChange={(ev) =>
                setFields((prev) => ({ ...prev, [key]: ev.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Ingesting…" : "Simulate lead"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? <p className="text-sm text-emerald-700">{result}</p> : null}
    </form>
  );
}
