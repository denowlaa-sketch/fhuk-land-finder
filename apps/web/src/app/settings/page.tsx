import Link from "next/link";
import { configStatus } from "@/lib/notify";
import { NotifyToggle } from "@/components/NotifyToggle";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const status = configStatus();

  return (
    <>
      <h1>Settings</h1>
      <p className="lede">
        Email alerts for new <strong>Strong</strong> /{" "}
        <strong>Investigate</strong> leads. Server delivery is controlled by
        environment variables; the toggle below only opts the dashboard paste
        save path out of notifying when alerts are enabled.
      </p>

      <section className="settings-block" aria-labelledby="notify-status-heading">
        <h2 id="notify-status-heading">Email notification status</h2>
        <dl className="detail-grid">
          <div className="field">
            <dt>Enabled (env)</dt>
            <dd>{status.enabled ? "yes" : "no"}</dd>
          </div>
          <div className="field">
            <dt>Mode</dt>
            <dd>{status.mode}</dd>
          </div>
          <div className="field">
            <dt>Provider</dt>
            <dd>{status.provider}</dd>
          </div>
          <div className="field">
            <dt>To</dt>
            <dd>{status.to.length ? status.to.join(", ") : "—"}</dd>
          </div>
          <div className="field">
            <dt>From</dt>
            <dd>{status.from}</dd>
          </div>
          <div className="field">
            <dt>Would send</dt>
            <dd>{status.would_send ? "yes" : "no (dry-run or incomplete)"}</dd>
          </div>
        </dl>
        <p className="meta-pill">
          Set <code>NOTIFY_EMAIL_ENABLED=true</code>,{" "}
          <code>NOTIFY_EMAIL_TO</code>, and a provider key (or SMTP). Default{" "}
          <code>NOTIFY_EMAIL_MODE=dry-run</code> logs the email without sending.
          See the repo README.
        </p>
      </section>

      <section className="settings-block" aria-labelledby="notify-toggle-heading">
        <h2 id="notify-toggle-heading">Dashboard paste alerts</h2>
        <NotifyToggle serverEnabled={status.enabled} />
      </section>

      <p>
        <Link className="back" href="/leads">
          ← Back to leads
        </Link>
      </p>
    </>
  );
}
