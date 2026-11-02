import Link from "next/link";
import { fetchLeads } from "@/lib/leads";

/** Always re-read DB/fixtures so a collector run shows up on refresh. */
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
  }).format(new Date(iso));
}

export default async function LeadsPage() {
  const { leads, source } = await fetchLeads();

  return (
    <>
      <h1>Leads</h1>
      <p className="lede">
        Off-market UK land opportunities for Greater Manchester pilot.
        Showing {leads.length} lead{leads.length === 1 ? "" : "s"} from{" "}
        {source === "database" ? "PostgreSQL" : "fixtures (no DATABASE_URL)"}.
        {source === "database"
          ? " Refresh after fhuk-collector run --write to see new rows."
          : " Set DATABASE_URL and migrate to load ingested leads."}{" "}
        <Link href="/paste">Paste a Facebook post</Link> to analyse without
        scraping. Email alerts for Strong/Investigate leads: see{" "}
        <Link href="/settings">Settings</Link>.
      </p>

      {leads.length === 0 ? (
        <div className="empty">
          No leads yet. Smoke path:{" "}
          <code>fhuk-collector run --provider recorded --write</code> then refresh
          this page.
        </div>
      ) : (
        <table className="leads-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Location</th>
              <th>Type</th>
              <th>Size</th>
              <th>Price</th>
              <th>AI</th>
              <th>Status</th>
              <th>Discovered</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link className="ref" href={`/leads/${lead.id}`}>
                    {lead.ref}
                  </Link>
                </td>
                <td>{lead.location}</td>
                <td>{lead.opportunity_type.replace("_", " ")}</td>
                <td>{lead.land_size ?? "—"}</td>
                <td>{formatPrice(lead.asking_price)}</td>
                <td>
                  <span className={`badge ${lead.ai_assessment}`}>
                    {lead.ai_assessment}
                  </span>
                </td>
                <td>{lead.contact_status}</td>
                <td>{formatDate(lead.date_discovered)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
