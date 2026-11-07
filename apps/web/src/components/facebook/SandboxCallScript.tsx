"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LAND_CALL_SCRIPT,
  evaluateCallOutcome,
  type CallAnswers,
} from "@/lib/twilio/script";

export function SandboxCallScript({
  leadId,
  consent,
}: {
  leadId: string;
  consent: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<CallAnswers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      if (!Object.keys(answers).length) return null;
      return evaluateCallOutcome(answers);
    } catch {
      return null;
    }
  }, [answers]);

  if (!consent) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        PECR block: no recorded call consent on this lead. Do not dial. Capture
        explicit Instant Form consent first.
      </div>
    );
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${leadId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage(`Sandbox attempt ${data.attempt.id.slice(0, 8)}… started`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function complete(outcome?: "NO_ANSWER" | "CALLBACK") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${leadId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          outcome ? { outcome } : { answers },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage(
        `Completed → ${data.attempt.outcome}; lead now ${data.lead.status}`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={start}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Start sandbox call
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => complete("NO_ANSWER")}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          Mark no-answer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => complete("CALLBACK")}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
        >
          Mark callback
        </button>
      </div>

      <ol className="space-y-3">
        {LAND_CALL_SCRIPT.filter((s) => s.id !== "done").map((step) => (
          <li
            key={step.id}
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-sm font-medium text-slate-900">{step.prompt}</p>
            {step.options ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {step.options.map((opt) => (
                  <button
                    key={opt.digit}
                    type="button"
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      answers[step.id] === opt.value
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [step.id]: opt.value }))
                    }
                  >
                    {opt.digit}: {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || Object.keys(answers).length < 4}
          onClick={() => complete()}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          Complete with answers
        </button>
        {preview ? (
          <span className="text-sm text-slate-600">
            Preview outcome: <strong>{preview}</strong>
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <p className="text-xs text-slate-500">
        QUALIFIED emails the owner only. NO_ANSWER / CALLBACK leave the lead
        CONTACTED so it returns to this queue.
      </p>
    </div>
  );
}
