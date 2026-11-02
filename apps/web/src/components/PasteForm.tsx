"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PasteAnalysis } from "@/lib/facebookPaste";
import type { Lead } from "@/lib/types";
import { readPasteNotifyPref } from "@/components/NotifyToggle";

interface AnalyzeResponse {
  analysis?: PasteAnalysis;
  saved?: boolean;
  created?: boolean;
  lead?: Lead;
  error?: string;
  note?: string;
  notify?: {
    dry_run?: boolean;
    sent?: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
    subject?: string;
  } | null;
}

export function PasteForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function run(save: boolean) {
    setError(null);
    setResult(null);
    const notify = readPasteNotifyPref(true);
    const res = await fetch("/api/analyze-paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url || null, text, save, notify }),
    });
    const body = (await res.json()) as AnalyzeResponse;
    if (!res.ok) {
      setError(body.error ?? "Analyse failed");
      return;
    }
    if (body.error && !body.analysis) {
      setError(body.error);
      return;
    }
    setResult(body);
    if (save && body.saved && body.lead) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="paste-panel">
      <p className="lede">
        Paste a <strong>public</strong> Facebook post URL (optional) and the post
        text you copied. We analyse the pasted text only — we never fetch,
        scrape, or call the Facebook Graph API.
      </p>

      <label className="paste-label" htmlFor="fb-url">
        Facebook post URL (not fetched)
      </label>
      <input
        id="fb-url"
        className="paste-input"
        type="url"
        placeholder="https://www.facebook.com/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={pending}
      />

      <label className="paste-label" htmlFor="fb-text">
        Pasted post text (required)
      </label>
      <textarea
        id="fb-text"
        className="paste-textarea"
        rows={8}
        placeholder="Paste the full public post text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        required
      />

      <div className="status-form">
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() => void run(false)}
        >
          {pending ? "Analysing…" : "Analyse"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={pending || !text.trim()}
          onClick={() => void run(true)}
        >
          Analyse &amp; save lead
        </button>
      </div>

      {error ? <p className="badge Reject">{error}</p> : null}

      {result?.analysis ? (
        <div className="paste-result">
          <h2>Assessment</h2>
          <p>
            <span className={`badge ${result.analysis.ai_assessment}`}>
              {result.analysis.ai_assessment}
            </span>{" "}
            · ownership{" "}
            <strong>{result.analysis.ownership_confidence}</strong>
          </p>
          <dl className="detail-grid">
            {(
              [
                ["Location", result.analysis.location],
                [
                  "Opportunity type",
                  result.analysis.opportunity_type.replace("_", " "),
                ],
                ["Planning", result.analysis.planning_status.replace("_", " ")],
                ["Landowner", result.analysis.landowner_name ?? "—"],
                ["Contact", result.analysis.contact ?? "— (none in pasted text)"],
                ["Source", result.analysis.source],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
              <div className="field" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="lede">{result.analysis.ai_rationale}</p>
          {result.note ? <p className="meta-pill">{result.note}</p> : null}
          {result.saved && result.lead ? (
            <p>
              Lead {result.created ? "created" : "updated"}:{" "}
              <Link href={`/leads/${result.lead.id}`}>{result.lead.ref}</Link>
            </p>
          ) : result.error ? (
            <p className="meta-pill">{result.error}</p>
          ) : (
            <p className="meta-pill">
              Preview only — use “Analyse &amp; save lead” when DATABASE_URL is
              set.
            </p>
          )}
          {result.notify ? (
            <p className="meta-pill">
              Notify:{" "}
              {result.notify.error
                ? `error — ${result.notify.error}`
                : result.notify.skipped
                  ? result.notify.reason ?? "skipped"
                  : result.notify.dry_run
                    ? `dry-run logged${result.notify.subject ? ` (${result.notify.subject})` : ""}`
                    : result.notify.sent
                      ? "email sent"
                      : "no alert (Reject or alerts disabled)"}
              {" · "}
              <Link href="/settings">settings</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
