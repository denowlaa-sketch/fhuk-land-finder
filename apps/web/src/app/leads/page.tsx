import { Suspense } from "react";
import Link from "next/link";
import { LeadFilters } from "@/components/LeadFilters";
import { LeadsTable } from "@/components/LeadsTable";
import { PageHeader } from "@/components/PageHeader";
import { fetchLeads } from "@/lib/leads";
import type {
  LeadCategory,
  PipelineStatus,
  QualificationLabel,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
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

  const { leads, source } = await fetchLeads(filters);

  return (
    <>
      <PageHeader
        title="Leads"
        description={
          <>
            CRM pipeline for off-market land plots. Showing {leads.length} from{" "}
            {source === "database" ? "PostgreSQL" : "fixtures"}.{" "}
            <Link href="/paste" className="font-medium">
              Facebook paste
            </Link>
          </>
        }
      />

      <Suspense
        fallback={
          <div className="mb-4 h-20 rounded-lg border border-slate-200 bg-white" />
        }
      >
        <LeadFilters basePath="/leads" />
      </Suspense>

      <LeadsTable leads={leads} />
    </>
  );
}
