import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusForm } from "@/components/StatusForm";
import { fetchLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

function formatPrice(value: number | null): string {
  if (value === null) return "—";
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

  const fields: Array<[string, string]> = [
    ["Ref", lead.ref],
    ["Location", lead.location],
    ["Opportunity type", lead.opportunity_type.replace("_", " ")],
    ["Land size", lead.land_size ?? "—"],
    ["Asking price", formatPrice(lead.asking_price)],
    ["Planning status", lead.planning_status.replace("_", " ")],
    ["Source", lead.source],
    ["Landowner", lead.landowner_name ?? "—"],
    ["Contact", lead.contact ?? "—"],
    ["Ownership confidence", lead.ownership_confidence],
    ["Seller motivation", lead.seller_motivation ?? "—"],
    ["AI assessment", lead.ai_assessment],
    ["Date discovered", formatDate(lead.date_discovered)],
    ["Contact status", lead.contact_status],
  ];

  return (
    <>
      <Link className="back" href="/leads">
        ← All leads
      </Link>
      <h1>{lead.ref}</h1>
      <p className="lede">
        {lead.location} ·{" "}
        <span className={`badge ${lead.ai_assessment}`}>
          {lead.ai_assessment}
        </span>
      </p>

      <dl className="detail-grid">
        {fields.map(([label, value]) => (
          <div className="field" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {lead.original_post_url ? (
        <p>
          Original post:{" "}
          <a href={lead.original_post_url} rel="noreferrer">
            {lead.original_post_url}
          </a>
        </p>
      ) : null}

      {lead.ai_rationale ? (
        <>
          <h2>AI rationale</h2>
          <p className="lede">{lead.ai_rationale}</p>
        </>
      ) : null}

      <h2>Pipeline status</h2>
      <StatusForm
        leadId={lead.id}
        current={lead.contact_status}
        readOnly={source === "fixtures"}
      />

      {lead.raw_excerpt ? (
        <>
          <h2>Source excerpt</h2>
          <div className="excerpt">{lead.raw_excerpt}</div>
        </>
      ) : null}
    </>
  );
}
