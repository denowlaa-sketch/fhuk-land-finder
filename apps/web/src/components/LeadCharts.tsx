import type { Lead } from "@/lib/types";
import { scoreBucket } from "@/lib/badges";

function BarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 truncate text-slate-600">
              {d.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded bg-emerald-600/80"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-slate-700">
              {d.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeadCharts({ leads }: { leads: Lead[] }) {
  const byStatus = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byScore = new Map<string, number>([
    ["80–100", 0],
    ["60–79", 0],
    ["40–59", 0],
    ["0–39", 0],
  ]);

  for (const lead of leads) {
    byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
    const cat = lead.category ?? "?";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    const bucket = scoreBucket(lead.score);
    byScore.set(bucket, (byScore.get(bucket) ?? 0) + 1);
  }

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-3">
      <BarChart
        title="By status"
        data={[...byStatus.entries()].map(([label, count]) => ({
          label,
          count,
        }))}
      />
      <BarChart
        title="By category"
        data={["A", "B", "C", "D", "?"].map((label) => ({
          label,
          count: byCategory.get(label) ?? 0,
        }))}
      />
      <BarChart
        title="By score"
        data={[...byScore.entries()].map(([label, count]) => ({
          label,
          count,
        }))}
      />
    </div>
  );
}
