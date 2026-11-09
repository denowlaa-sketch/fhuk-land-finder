import Link from "next/link";
import { AdLeadSimulateForm } from "@/components/ad-leads/AdLeadSimulateForm";
import { CallQueue } from "@/components/ad-leads/CallQueue";
import { PageHeader } from "@/components/PageHeader";
import { getCallQueue } from "@/lib/facebook/calls";
import { facebookConfigStatus } from "@/lib/facebook/env";
import { configStatus } from "@/lib/notify";
import { tiktokConfigStatus } from "@/lib/tiktok/env";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

export default async function AdLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ channel?: string }>;
}) {
  const sp = (await searchParams) || {};
  const channelRaw = (sp.channel || "all").toLowerCase();
  const channel =
    channelRaw === "facebook" ||
    channelRaw === "instagram" ||
    channelRaw === "tiktok"
      ? channelRaw
      : "all";

  let queue: Awaited<ReturnType<typeof getCallQueue>> = [];
  let queueError: string | null = null;
  try {
    queue = await getCallQueue({ channel });
  } catch (err) {
    queueError = err instanceof Error ? err.message : String(err);
  }

  const fb = facebookConfigStatus();
  const tiktok = tiktokConfigStatus();
  const twilio = twilioStatus();
  const email = configStatus();

  const recall = queue.filter(
    (q) =>
      q.latest_attempt?.outcome === "NO_ANSWER" ||
      q.latest_attempt?.outcome === "CALLBACK",
  );

  const filters: Array<{ key: string; label: string }> = [
    { key: "all", label: "All" },
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
  ];

  return (
    <>
      <PageHeader
        title="Ad Leads / Calls"
        description={
          <>
            PECR-safe Meta (Facebook + Instagram Lead Ads) and TikTok Lead Gen:
            score on webhook, call queue only with recorded consent, owner email
            only when call-qualified. URL paste stays on{" "}
            <Link href="/paste">/paste</Link>.
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [
              "Meta webhook (FB+IG)",
              fb.webhookReady ? "ready" : "configure tokens",
            ],
            [
              "TikTok webhook",
              tiktok.webhookVerifyReady
                ? tiktok.leadFetchReady
                  ? "ready + fetch"
                  : "verify ready (stub ingest)"
                : "configure verify token",
            ],
            ["Twilio live", twilio.ready ? "ready" : "sandbox only"],
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
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Call queue
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              FACEBOOK | INSTAGRAM | TIKTOK + consent_to_call + phone +
              NEW|CONTACTED. Recalls: {recall.length} with NO_ANSWER/CALLBACK.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <Link
                key={f.key}
                href={
                  f.key === "all" ? "/ad-leads" : `/ad-leads?channel=${f.key}`
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium no-underline ${
                  channel === f.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        {queueError ? (
          <p className="text-sm text-amber-800">
            Queue unavailable ({queueError}). Apply migrations{" "}
            <code>003_facebook_calls.sql</code> and{" "}
            <code>004_ad_leads_channels.sql</code>.
          </p>
        ) : (
          <CallQueue items={queue} />
        )}
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <AdLeadSimulateForm channel="facebook" />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <AdLeadSimulateForm channel="instagram" />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <AdLeadSimulateForm channel="tiktok" />
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Webhooks: <code>GET/POST /api/facebook/leadgen</code> (Meta FB+IG),{" "}
        <code>GET/POST /api/tiktok/leads</code>. Live dials require{" "}
        <code>TWILIO_LIVE_DIALS=true</code>. Never dial without{" "}
        <code>consent_to_call</code>.
      </p>
    </>
  );
}
