export function StatCards({
  stats,
}: {
  stats: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {s.label}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-slate-900">
            {s.value}
          </div>
          {s.hint ? (
            <div className="mt-0.5 text-xs text-slate-500">{s.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
