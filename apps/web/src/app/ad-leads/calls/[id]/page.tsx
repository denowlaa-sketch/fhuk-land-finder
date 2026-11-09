import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveDialButton } from "@/components/facebook/LiveDialButton";
import { SandboxCallScript } from "@/components/facebook/SandboxCallScript";
import { PageHeader } from "@/components/PageHeader";
import { AD_CHANNEL_LABELS, type AdChannel } from "@/lib/ad-leads/channels";
import { getLatestAttemptForLead } from "@/lib/facebook/calls";
import { getLeadById } from "@/lib/db";
import { extractPhone } from "@/lib/twilio/phone";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdLeadCallPage({ params }: Props) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const attempt = await getLatestAttemptForLead(id);
  const consent = Boolean(lead.consent_to_call);
  const twilio = twilioStatus();
  const phone = extractPhone(lead.contact);
  const channel =
    lead.ad_channel ||
    (lead.source_kind === "INSTAGRAM"
      ? "instagram"
      : lead.source_kind === "TIKTOK"
        ? "tiktok"
        : lead.source_kind === "FACEBOOK"
          ? "facebook"
          : null);
  const channelLabel = channel
    ? AD_CHANNEL_LABELS[channel as AdChannel]
    : lead.source_kind;

  return (
    <>
      <PageHeader
        title={`Call ${lead.ref}`}
        description={
          <>
            {lead.location} · {channelLabel} · {lead.status} ·{" "}
            {consent ? "consent recorded" : "no consent"} · phone{" "}
            {phone ?? "missing"}
          </>
        }
        actions={
          <Link href="/ad-leads" className="text-sm">
            ← Queue
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-display text-base font-semibold">Lead</h2>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline text-slate-500">Owner: </dt>
              <dd className="inline">{lead.landowner_name || "Unknown"}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Contact: </dt>
              <dd className="inline">{lead.contact || "Unknown"}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Motivation: </dt>
              <dd className="inline">{lead.seller_motivation || "Unknown"}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Score: </dt>
              <dd className="inline">
                {lead.score} / {lead.qualification_label}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Channel: </dt>
              <dd className="inline">
                {channelLabel} ({lead.source_kind})
              </dd>
            </div>
            {attempt ? (
              <div>
                <dt className="inline text-slate-500">Latest attempt: </dt>
                <dd className="inline">
                  {attempt.mode} · {attempt.status}
                  {attempt.outcome ? ` · ${attempt.outcome}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-display text-base font-semibold">
            Live Twilio
          </h2>
          <LiveDialButton
            leadId={lead.id}
            consent={consent}
            twilioReady={twilio.ready}
          />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-semibold text-slate-900">
          Sandbox qualify script
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Land script: plot, location, motivation, timeline — not solar
          panels/roof/bill.
        </p>
        <SandboxCallScript leadId={lead.id} consent={consent} />
      </section>
    </>
  );
}
