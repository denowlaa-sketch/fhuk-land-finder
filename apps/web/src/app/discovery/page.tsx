import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ImportButton } from "@/components/ImportButton";
import { PageHeader } from "@/components/PageHeader";
import { assessmentBadgeClass } from "@/lib/badges";
import { getPool } from "@/lib/db";
import { fetchDiscoveryProspects } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const { prospects, source } = await fetchDiscoveryProspects({
    pendingOnly: true,
  });
  const canImport = Boolean(getPool());

  return (
    <>
      <PageHeader
        title="Discovery"
        description={
          <>
            Collector findings inbox — import into CRM leads with URL / hash
            dedupe. Showing {prospects.length} pending from{" "}
            {source === "database"
              ? "PostgreSQL discovery_prospects"
              : "fixtures / recorded samples"}.{" "}
            <Link href="/paste" className="font-medium">
              Facebook paste
            </Link>{" "}
            remains a separate intake channel.
          </>
        }
      />

      {prospects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No pending prospects. Run{" "}
          <code className="rounded bg-slate-100 px-1">
            fhuk-collector run --provider recorded --write
          </code>{" "}
          to fill the inbox (writes discovery_prospects after migration 002).
        </div>
      ) : (
        <ul className="space-y-3">
          {prospects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-slate-900">
                    {p.title}
                  </h2>
                  <Badge className="bg-slate-50 text-slate-600 ring-slate-200">
                    {p.source_kind}
                  </Badge>
                  {p.preview_assessment ? (
                    <Badge
                      className={assessmentBadgeClass(p.preview_assessment)}
                    >
                      {p.preview_assessment}
                    </Badge>
                  ) : null}
                  {p.preview_score != null ? (
                    <span className="text-xs tabular-nums text-slate-500">
                      preview {p.preview_score}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {p.location ?? "Unknown location"} · {p.source}
                </p>
                {p.snippet ? (
                  <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                    {p.snippet}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-slate-400">
                    No snippet — contact facts unknown until extract/import.
                  </p>
                )}
                {p.source_url ? (
                  <a
                    href={p.source_url}
                    className="mt-2 inline-block truncate text-xs"
                    rel="noreferrer"
                  >
                    {p.source_url}
                  </a>
                ) : null}
              </div>
              <ImportButton prospectId={p.id} disabled={!canImport} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
