"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LiveDialButton({
  leadId,
  consent,
  twilioReady,
}: {
  leadId: string;
  consent: boolean;
  twilioReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!consent) {
    return (
      <p className="text-sm text-amber-800">
        Live dial blocked — no PECR call consent on this lead.
      </p>
    );
  }

  async function dial() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/calls/${leadId}/dial`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOk(
        `Live call placed (${data.attempt.twilio_call_sid || data.attempt.id})`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy || !twilioReady}
        onClick={dial}
        className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
      >
        {busy ? "Dialling…" : "Live Twilio dial"}
      </button>
      {!twilioReady ? (
        <p className="text-xs text-slate-500">
          Configure TWILIO_* and set TWILIO_LIVE_DIALS=true. Prefer sandbox until
          counsel confirms consent capture.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Places a real call with the land qualify keypad script. Use sparingly.
        </p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
    </div>
  );
}
