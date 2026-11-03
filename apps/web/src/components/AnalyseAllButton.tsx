"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AnalyseAllButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/leads/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      count?: number;
    } | null;
    if (!res.ok) {
      setError(body?.error ?? "Analyse failed");
      return;
    }
    setOk(`Re-scored ${body?.count ?? 0} lead(s)`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Analysing…" : "Analyse all"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      {ok ? <span className="text-xs text-emerald-700">{ok}</span> : null}
    </div>
  );
}
