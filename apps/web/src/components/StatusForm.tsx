"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONTACT_STATUSES, type ContactStatus } from "@/lib/types";

export function StatusForm({
  leadId,
  current,
  readOnly,
}: {
  leadId: string;
  current: ContactStatus;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactStatus>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return (
      <p className="meta-pill">
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
      body: JSON.stringify({ contact_status: status }),
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
    <form className="status-form" onSubmit={onSubmit}>
      <label htmlFor="contact_status">Contact status</label>
      <select
        id="contact_status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ContactStatus)}
        disabled={pending}
      >
        {CONTACT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </button>
      {error ? <span className="badge Reject">{error}</span> : null}
    </form>
  );
}
