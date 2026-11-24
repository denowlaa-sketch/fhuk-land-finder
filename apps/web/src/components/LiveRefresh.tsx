"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Default poll interval for ops CRM list/queue surfaces. */
export const LIVE_REFRESH_MS = 30_000;

/**
 * Soft-refetch RSC payloads via `router.refresh()` so pipeline / call-queue
 * pages stay current without a full reload. Pauses while the tab is hidden.
 */
export function LiveRefresh({
  intervalMs = LIVE_REFRESH_MS,
  showStatus = true,
}: {
  intervalMs?: number;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const refreshing = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (cancelled || document.visibilityState === "hidden") return;
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        router.refresh();
        if (!cancelled) setLastAt(Date.now());
      } finally {
        refreshing.current = false;
      }
    }

    // Initial stamp so the UI shows we are live; first poll after interval.
    setLastAt(Date.now());

    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);

    const tickId = window.setInterval(() => setTick((n) => n + 1), 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearInterval(tickId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, router]);

  if (!showStatus) return null;

  void tick; // re-render every 5s for relative label
  const label = formatAgo(lastAt);

  return (
    <div
      className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"
      title={`Auto-refreshes every ${Math.round(intervalMs / 1000)}s while this tab is open`}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80"
        aria-hidden
      />
      <span>Live · {label}</span>
    </div>
  );
}

function formatAgo(at: number | null): string {
  if (at == null) return "starting…";
  const sec = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}
