"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  PIPELINE_STATUSES,
  QUALIFICATION_LABELS,
  type LeadCategory,
} from "@/lib/types";

const CATEGORIES: LeadCategory[] = ["A", "B", "C", "D"];

export function LeadFilters({ basePath = "/" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      const qs = next.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  }

  return (
    <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Status
        <select
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          value={params.get("status") ?? ""}
          disabled={pending}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Category
        <select
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          value={params.get("category") ?? ""}
          disabled={pending}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Qualification
        <select
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          value={params.get("qualification") ?? ""}
          disabled={pending}
          onChange={(e) => update("qualification", e.target.value)}
        >
          <option value="">All</option>
          {QUALIFICATION_LABELS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Min score
        <input
          type="number"
          min={0}
          max={100}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          defaultValue={params.get("minScore") ?? ""}
          disabled={pending}
          onBlur={(e) => update("minScore", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update("minScore", (e.target as HTMLInputElement).value);
            }
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        Search
        <input
          type="search"
          placeholder="Location, ref…"
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          defaultValue={params.get("q") ?? ""}
          disabled={pending}
          onBlur={(e) => update("q", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update("q", (e.target as HTMLInputElement).value);
            }
          }}
        />
      </label>
    </div>
  );
}
