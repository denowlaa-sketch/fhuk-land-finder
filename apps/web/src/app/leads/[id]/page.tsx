import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { ReanalyseButton } from "@/components/ReanalyseButton";
import { StatusForm } from "@/components/StatusForm";
import {
  assessmentBadgeClass,
  categoryBadgeClass,
  qualificationBadgeClass,
  statusBadgeClass,
} from "@/lib/badges";
import { fetchLead, fetchLeadAnalyses } from "@/lib/leads";
import { displayUnknown } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatPrice(value: number | null): string {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, source } = await fetchLead(id);
  if (!lead) notFound();
  const analyses = await fetchLeadAnalyses(lead.id, source, lead);

  return (
    <>
      <Link
        href="/leads"
        className="mb-3 inline-block text-sm text-slate-500 no-underline hover:text-emerald-700"
      >
        ← All leads
      </Link>

      <PageHeader
        title={lead.ref}
        description={
          <>
            {lead.location} · score {lead.score}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge className={statusBadgeClass(lead.status)}>{lead.status}</Badge>
            <Badge className={categoryBadgeClass(lead.category)}>
              Cat {lead.category ?? "—"}
            </Badge>
            <Badge
              className={qualificationBadgeClass(lead.qualification_label)}
            >
              {lead.qualification_label}
            </Badge>
            <Badge className={assessmentBadgeClass(lead.ai_assessment)}>
              {lead.ai_assessment}
            </Badge>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["Opportunity", lead.opportunity_type.replace("_", " ")],
            ["Land size", displayUnknown(lead.land_size)],
            ["Asking price", formatPrice(lead.asking_price)],
            ["Planning", lead.planning_status.replace("_", " ")],
            ["Source", lead.source],
            ["Source kind", lead.source_kind],
            ["Landowner", displayUnknown(lead.landowner_name)],
            ["Contact", displayUnknown(lead.contact)],
            ["Ownership", lead.ownership_confidence],
            ["Motivation", displayUnknown(lead.seller_motivation)],
            ["Discovered", formatDate(lead.date_discovered)],
            [
              "Last analysed",
              lead.last_analysed_at
                ? formatDate(lead.last_analysed_at)
                : "Unknown",
            ],
          ] as Array<[string, string]>
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-sm text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {lead.original_post_url ? (
        <p className="mb-4 text-sm">
          Source URL:{" "}
          <a href={lead.original_post_url} rel="noreferrer">
            {lead.original_post_url}
          </a>
        </p>
      ) : null}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Scoring breakdown
          </h2>
          <ReanalyseButton leadId={lead.id} disabled={source === "fixtures"} />
        </div>
        <ul className="mb-4 space-y-1.5 text-sm">
          {lead.reasons.length === 0 ? (
            <li className="text-slate-500">No reasons recorded yet.</li>
          ) : (
            lead.reasons.map((r, i) => (
              <li key={`${r.code}-${i}`} className="flex gap-2 text-slate-700">
                <span className="w-14 shrink-0 tabular-nums text-slate-500">
                  {typeof r.delta === "number"
                    ? `${r.delta > 0 ? "+" : ""}${r.delta}`
                    : "·"}
                </span>
                <span>
                  <span className="font-medium text-slate-800">{r.code}</span>
                  {" — "}
                  {r.detail}
                </span>
              </li>
            ))
          )}
        </ul>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Unknowns</h3>
        {lead.unknowns.length === 0 ? (
          <p className="text-sm text-slate-500">No unknown fields flagged.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {lead.unknowns.map((u) => (
              <li key={u}>
                <Badge className="bg-slate-50 text-slate-600 ring-slate-200">
                  {u}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Pipeline {lead.pipeline_version}. Contact and price are never invented
          — missing values show as Unknown.
        </p>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Pipeline
        </h2>
        <StatusForm
          leadId={lead.id}
          current={lead.status}
          readOnly={source === "fixtures"}
        />
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Analysis history
        </h2>
        {analyses.length === 0 ? (
          <p className="text-sm text-slate-500">No analysis runs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {analyses.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 py-2 text-slate-700"
              >
                <span className="tabular-nums font-medium">{a.score}</span>
                <Badge className={categoryBadgeClass(a.category)}>
                  {a.category ?? "—"}
                </Badge>
                <Badge
                  className={qualificationBadgeClass(a.qualification_label)}
                >
                  {a.qualification_label}
                </Badge>
                <span className="text-slate-500">{formatDate(a.ran_at)}</span>
                <span className="text-xs text-slate-400">
                  {a.pipeline_version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lead.raw_excerpt ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-display text-lg font-semibold text-slate-900">
            Source excerpt
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-700">
            {lead.raw_excerpt}
          </pre>
        </section>
      ) : null}
    </>
  );
}
