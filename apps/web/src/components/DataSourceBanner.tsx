/** Shown when the dashboard falls back to fixtures — distinguishes missing env vs DB failure. */
export function DataSourceBanner({
  source,
  databaseConfigured,
  dbError,
}: {
  source: "database" | "fixtures";
  databaseConfigured: boolean;
  dbError?: string;
}) {
  if (source === "database") return null;

  if (databaseConfigured) {
    return (
      <div
        role="alert"
        className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <p className="font-semibold">DATABASE_URL is set but Postgres failed</p>
        <p className="mt-1 text-amber-900/90">
          Showing fixture demo data. Check pooled URL,{" "}
          <code className="rounded bg-amber-100 px-1">sslmode=require</code>,
          Neon pooler host, migration applied, then redeploy.
          {dbError ? (
            <>
              {" "}
              Error:{" "}
              <code className="break-all rounded bg-amber-100 px-1">
                {dbError}
              </code>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
    >
      <p className="font-semibold">Demo mode — no DATABASE_URL</p>
      <p className="mt-1">
        Set <code className="rounded bg-slate-200 px-1">DATABASE_URL</code> on
        the Vercel project (not just{" "}
        <code className="rounded bg-slate-200 px-1">POSTGRES_URL</code>), for
        the same environment you are viewing (Production vs Preview), then
        redeploy.
      </p>
    </div>
  );
}
