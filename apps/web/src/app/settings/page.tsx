import Link from "next/link";
import { NotifyToggle } from "@/components/NotifyToggle";
import { PageHeader } from "@/components/PageHeader";
import { configStatus } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const status = configStatus();

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          <>
            Owner-only email alerts for Strong / Investigate (QUALIFIED-analogue)
            leads. Env-gated providers — no end-user auth.
          </>
        }
      />

      <section className="mb-6 max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Email notification status
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Enabled (env)", status.enabled ? "yes" : "no"],
              ["Mode", status.mode],
              ["Provider", status.provider],
              ["To", status.to.length ? status.to.join(", ") : "—"],
              ["From", status.from],
              [
                "Would send",
                status.would_send ? "yes" : "no (dry-run or incomplete)",
              ],
            ] as Array<[string, string]>
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Set <code>NOTIFY_EMAIL_ENABLED=true</code>,{" "}
          <code>NOTIFY_EMAIL_TO</code>, and a provider key. Default mode is
          dry-run.
        </p>
      </section>

      <section className="mb-6 max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Dashboard paste alerts
        </h2>
        <NotifyToggle serverEnabled={status.enabled} />
      </section>

      <p>
        <Link href="/paste" className="text-sm">
          Facebook URL paste intake →
        </Link>
      </p>
    </>
  );
}
