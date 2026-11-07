"use client";

import Link from "next/link";
import type { CallQueueItem } from "@/lib/facebook/calls";

export function CallQueue({ items }: { items: CallQueueItem[] }) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-600">
        Queue empty. Consented Instant Form leads with a phone and status NEW or
        CONTACTED appear here (including NO_ANSWER / CALLBACK recalls).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">Ref</th>
            <th className="px-2 py-2 font-medium">Location</th>
            <th className="px-2 py-2 font-medium">Phone</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium">Score</th>
            <th className="px-2 py-2 font-medium">Last attempt</th>
            <th className="px-2 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="px-2 py-2 font-medium text-slate-900">{item.ref}</td>
              <td className="px-2 py-2 text-slate-700">{item.location}</td>
              <td className="px-2 py-2 text-slate-700">{item.phone ?? "—"}</td>
              <td className="px-2 py-2">{item.status}</td>
              <td className="px-2 py-2">{item.score}</td>
              <td className="px-2 py-2 text-slate-600">
                {item.latest_attempt
                  ? `${item.latest_attempt.outcome ?? item.latest_attempt.status} (${item.latest_attempt.mode})`
                  : "—"}
              </td>
              <td className="px-2 py-2 text-right">
                <Link
                  href={`/facebook/calls/${item.id}`}
                  className="text-emerald-700 no-underline hover:underline"
                >
                  Open call →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
