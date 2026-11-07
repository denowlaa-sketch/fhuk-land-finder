import Link from "next/link";
import { CallQueue } from "@/components/facebook/CallQueue";
import { FacebookLeadForm } from "@/components/facebook/FacebookLeadForm";
import { PageHeader } from "@/components/PageHeader";
import { getCallQueue } from "@/lib/facebook/calls";
import { facebookConfigStatus } from "@/lib/facebook/env";
import { configStatus } from "@/lib/notify";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

export default async function FacebookPage() {
  let queue: Awaited<ReturnType<typeof getCallQueue>> = [];
  let queueError: string | null = null;
  try {
    queue = await getCallQueue();
  } catch (err) {
    queueError = err instanceof Error ? err.message : String(err);
  }

  const fb = facebookConfigStatus();
  const twilio = twilioStatus();
  const email = configStatus();

  const recall = queue.filter(
    (q) =>
      q.latest_attempt?.outcome === "NO_ANSWER" ||
      q.latest_attempt?.outcome === "CALLBACK",
  );

  return (
    <>
      <PageHeader
        title="Facebook Instant Form"
        description={
          <>
            PECR-safe intake: score on webhook, auto-call only with recorded
            consent, owner email only when call-qualified. URL paste stays on{" "}
            <Link href="/paste">/paste</Link>.
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            [
              "Meta webhook",
              fb.webhookReady ? "ready" : "configure tokens",
            ],
            [
              "Twilio live",
              twilio.ready ? "ready" : "sandbox only",
            ],
            [
              "Owner email",
              email.ready || Boolean(process.env.OWNER_NOTIFY_EMAIL)
                ? email.mode
                : "unset",
            ],
          ] as Array<[string, string]>
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-900">
              {value}
            </div>
          </div>
        ))}
      </div>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-display text-lg font-semibold text-slate-900">
          Call queue
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          FACEBOOK + consent_to_call + phone + NEW|CONTACTED. Recalls:{" "}
          {recall.length} with NO_ANSWER/CALLBACK.
        </p>
        {queueError ? (
          <p className="text-sm text-amber-800">
            Queue unavailable ({queueError}). Apply migration{" "}
            <code>003_facebook_calls.sql</code>.
          </p>
        ) : (
          <CallQueue items={queue} />
        )}
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Simulate Instant Form
        </h2>
        <FacebookLeadForm />
      </section>
    </>
  );
}
