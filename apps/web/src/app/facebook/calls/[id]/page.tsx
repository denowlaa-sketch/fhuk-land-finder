import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveDialButton } from "@/components/facebook/LiveDialButton";
import { SandboxCallScript } from "@/components/facebook/SandboxCallScript";
import { PageHeader } from "@/components/PageHeader";
import { getLatestAttemptForLead } from "@/lib/facebook/calls";
import { getLeadById } from "@/lib/db";
import { extractPhone } from "@/lib/twilio/phone";
import { twilioStatus } from "@/lib/twilio/env";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function FacebookCallPage({ params }: Props) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const attempt = await getLatestAttemptForLead(id);
  const consent = Boolean(lead.consent_to_call);
  const twilio = twilioStatus();
  const phone = extractPhone(lead.contact);

  return (
    <>
      <PageHeader
        title={`Call ${lead.ref}`}
        description={
          <>
            {lead.location} · {lead.status} ·{" "}
            {consent ? "consent recorded" : "no consent"} · phone{" "}
            {phone ?? "missing"}
          </>
        }
        actions={
          <Link href="/facebook" className="text-sm">
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
              <dt className="inline text-slate-500">Score: </dt>
              <dd className="inline">
                {lead.score} / {lead.qualification_label}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Source: </dt>
              <dd className="inline">{lead.source_kind}</dd>
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
        <SandboxCallScript leadId={lead.id} consent={consent} />
      </section>
    </>
  );
}
