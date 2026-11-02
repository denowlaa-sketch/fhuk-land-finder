"use client";

import { useEffect, useState } from "react";

export const PASTE_NOTIFY_PREF_KEY = "fhuk.notify.paste";

export function readPasteNotifyPref(defaultValue = true): boolean {
  if (typeof window === "undefined") return defaultValue;
  const raw = window.localStorage.getItem(PASTE_NOTIFY_PREF_KEY);
  if (raw === null) return defaultValue;
  return raw === "1" || raw === "true";
}

export function NotifyToggle({ serverEnabled }: { serverEnabled: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEnabled(readPasteNotifyPref(true));
    setReady(true);
  }, []);

  function onChange(next: boolean) {
    setEnabled(next);
    window.localStorage.setItem(PASTE_NOTIFY_PREF_KEY, next ? "1" : "0");
  }

  return (
    <div className="notify-toggle">
      <label className="notify-toggle-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          onChange={(e) => onChange(e.target.checked)}
        />
        Email me when a pasted Strong/Investigate lead is saved
      </label>
      <p className="meta-pill">
        {serverEnabled
          ? "Server alerts are enabled. Uncheck to skip email on dashboard paste saves (collector --write still follows env)."
          : "Server alerts are off (NOTIFY_EMAIL_ENABLED). This toggle is stored in your browser only."}
      </p>
    </div>
  );
}
