"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ImportButton({
  prospectId,
  disabled,
}: {
  prospectId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/discovery/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospectId }),
    });
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      lead?: { id: string; ref: string };
      duplicate?: boolean;
      created?: boolean;
    } | null;
    if (!res.ok) {
      setError(body?.error ?? "Import failed");
      return;
    }
    if (body?.duplicate) {
      setMessage(`Already imported as ${body.lead?.ref ?? "lead"}`);
    } else {
      setMessage(`Imported ${body?.lead?.ref ?? "lead"}`);
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      {message ? (
        <span className="text-xs text-emerald-700">{message}</span>
      ) : null}
    </div>
  );
}
