import { Suspense } from "react";
import Link from "next/link";
import { AnalyseAllButton } from "@/components/AnalyseAllButton";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { LeadCharts } from "@/components/LeadCharts";
import { LeadFilters } from "@/components/LeadFilters";
import { LeadsTable } from "@/components/LeadsTable";
import { PageHeader } from "@/components/PageHeader";
import { StatCards } from "@/components/StatCards";
import { fetchLeads } from "@/lib/leads";
import type {
  LeadCategory,
  PipelineStatus,
  QualificationLabel,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    status: (typeof sp.status === "string" ? sp.status : "") as
      | PipelineStatus
      | "",
    category: (typeof sp.category === "string" ? sp.category : "") as
      | LeadCategory
      | "",
    qualification: (typeof sp.qualification === "string"
      ? sp.qualification
      : "") as QualificationLabel | "",
    search: typeof sp.q === "string" ? sp.q : "",
    minScore:
      typeof sp.minScore === "string" && sp.minScore !== ""
        ? Number(sp.minScore)
        : undefined,
  };

  const { leads, source, databaseConfigured, dbError } =
    await fetchLeads(filters);
  const avgScore =
    leads.length === 0
      ? 0
      : Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length);
  const qualified = leads.filter((l) => l.status === "QUALIFIED").length;
  const top = [...leads].sort((a, b) => b.score - a.score).slice(0, 3);
  const sourceLabel =
    source === "database"
      ? "PostgreSQL"
      : databaseConfigured
        ? "fixtures (DATABASE_URL set — connection failed)"
        : "fixtures (no DATABASE_URL)";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            Pipeline overview for Greater Manchester land opportunities. Data
            from {sourceLabel}.{" "}
            <Link href="/discovery" className="font-medium text-emerald-700">
              Open Discovery inbox
            </Link>
          </>
        }
        actions={<AnalyseAllButton disabled={source === "fixtures"} />}
      />

      <DataSourceBanner
        source={source}
        databaseConfigured={databaseConfigured}
        dbError={dbError}
      />

      <StatCards
        stats={[
          { label: "Leads", value: leads.length, hint: "Matching filters" },
          { label: "Avg score", value: avgScore },
          { label: "Qualified", value: qualified },
          {
            label: "Top score",
            value: top[0]?.score ?? "—",
            hint: top[0]?.ref,
          },
        ]}
      />

      <Suspense
        fallback={
          <div className="mb-4 h-20 rounded-lg border border-slate-200 bg-white" />
        }
      >
        <LeadFilters basePath="/" />
      </Suspense>

      <LeadCharts leads={leads} />

      {top.length > 0 ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Top leads
          </h2>
          <ul className="flex flex-wrap gap-3 text-sm">
            {top.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leads/${l.id}`}
                  className="font-semibold text-emerald-700 no-underline hover:underline"
                >
                  {l.ref}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {l.score} · {l.location}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LeadsTable leads={leads} />
    </>
  );
}
