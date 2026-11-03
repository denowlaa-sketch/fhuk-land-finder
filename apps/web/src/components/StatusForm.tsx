"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PIPELINE_STATUSES, type PipelineStatus } from "@/lib/types";

export function StatusForm({
  leadId,
  current,
  readOnly,
}: {
  leadId: string;
  current: PipelineStatus;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PipelineStatus>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return (
      <p className="text-sm text-slate-500">
        Status updates require DATABASE_URL (fixture mode is read-only).
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Could not update status");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={onSubmit}>
      <label htmlFor="pipeline_status" className="text-sm text-slate-600">
        Pipeline status
      </label>
      <select
        id="pipeline_status"
        value={status}
        onChange={(e) => setStatus(e.target.value as PipelineStatus)}
        disabled={pending}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Update"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </form>
  );
}
