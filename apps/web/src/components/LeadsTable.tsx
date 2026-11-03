import Link from "next/link";
import { Badge } from "@/components/Badge";
import {
  assessmentBadgeClass,
  categoryBadgeClass,
  qualificationBadgeClass,
  statusBadgeClass,
} from "@/lib/badges";
import { displayUnknown, type Lead } from "@/lib/types";

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
  }).format(new Date(iso));
}

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
        No leads match these filters. Import from Discovery or run the collector.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">Ref</th>
            <th className="px-3 py-2.5 font-medium">Location</th>
            <th className="px-3 py-2.5 font-medium">Score</th>
            <th className="px-3 py-2.5 font-medium">Cat</th>
            <th className="px-3 py-2.5 font-medium">Qualification</th>
            <th className="px-3 py-2.5 font-medium">Assessment</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Price</th>
            <th className="px-3 py-2.5 font-medium">Discovered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/80">
              <td className="px-3 py-2.5">
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-semibold text-emerald-700 no-underline hover:underline"
                >
                  {lead.ref}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-slate-800">{lead.location}</td>
              <td className="px-3 py-2.5 tabular-nums font-medium text-slate-900">
                {lead.score}
              </td>
              <td className="px-3 py-2.5">
                <Badge className={categoryBadgeClass(lead.category)}>
                  {lead.category ?? "—"}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <Badge
                  className={qualificationBadgeClass(lead.qualification_label)}
                >
                  {lead.qualification_label}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <Badge className={assessmentBadgeClass(lead.ai_assessment)}>
                  {lead.ai_assessment}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <Badge className={statusBadgeClass(lead.status)}>
                  {lead.status}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-slate-700">
                {formatPrice(lead.asking_price)}
              </td>
              <td className="px-3 py-2.5 text-slate-500">
                {formatDate(lead.date_discovered)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">
        Contact blanks show as {displayUnknown(null)} — never invented.
      </p>
    </div>
  );
}
