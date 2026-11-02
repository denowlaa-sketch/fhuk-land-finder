/**
 * Optional email notifications for Strong / Investigate leads.
 * Providers: smtp (nodeless HTTP fallbacks: Resend / SendGrid), dry-run log mode.
 */

export type NotifyableAssessment = "Strong" | "Investigate";
export type NotifyMode = "dry-run" | "send";
export type NotifyProvider = "smtp" | "resend" | "sendgrid";

export interface LeadNotifyPayload {
  ref: string;
  location: string;
  opportunity_type: string;
  ai_assessment: string;
  source: string;
  original_post_url?: string | null;
  ai_rationale?: string | null;
}

export interface NotifyResult {
  mode: NotifyMode;
  provider: NotifyProvider;
  to: string[];
  from: string;
  subject: string;
  payload: LeadNotifyPayload;
  sent: boolean;
  dry_run?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  response?: unknown;
}

const NOTIFYABLE = new Set(["Strong", "Investigate"]);

function truthy(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function notificationsEnabled(): boolean {
  return truthy(process.env.NOTIFY_EMAIL_ENABLED, false);
}

export function notifyMode(): NotifyMode {
  const raw = (process.env.NOTIFY_EMAIL_MODE || "dry-run").trim().toLowerCase();
  if (raw === "send" || raw === "live") return "send";
  return "dry-run";
}

export function notifyProvider(): NotifyProvider {
  const raw = (process.env.NOTIFY_EMAIL_PROVIDER || "smtp").trim().toLowerCase();
  if (raw === "resend" || raw === "sendgrid" || raw === "smtp") return raw;
  return "smtp";
}

export function notifyRecipients(): string[] {
  return (process.env.NOTIFY_EMAIL_TO || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function notifyFrom(): string {
  return (
    process.env.NOTIFY_EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "land-finder@localhost"
  );
}

export function shouldNotify(
  assessment: string,
  created = true,
): boolean {
  if (!created) return false;
  if (!NOTIFYABLE.has(assessment)) return false;
  return notificationsEnabled();
}

export function configStatus() {
  const recipients = notifyRecipients();
  const mode = notifyMode();
  const provider = notifyProvider();
  const enabled = notificationsEnabled();
  const ready = Boolean(recipients.length) && enabled;
  return {
    enabled,
    mode,
    provider,
    to: recipients,
    from: notifyFrom(),
    ready,
    would_send: ready && mode === "send",
  };
}

export function leadSubject(payload: LeadNotifyPayload): string {
  return `[FHUK Land Finder] ${payload.ai_assessment} lead ${payload.ref} — ${payload.location}`;
}

export function leadBodyText(payload: LeadNotifyPayload): string {
  const lines = [
    "New land lead (Flipping Homes UK Land Finder)",
    "",
    `Ref:         ${payload.ref}`,
    `Location:    ${payload.location}`,
    `Type:        ${payload.opportunity_type}`,
    `Assessment:  ${payload.ai_assessment}`,
    `Source:      ${payload.source}`,
    `Source link: ${payload.original_post_url || "(none)"}`,
  ];
  if (payload.ai_rationale) {
    lines.push("", "Rationale:", payload.ai_rationale);
  }
  return `${lines.join("\n")}\n`;
}

async function sendResend(
  payload: LeadNotifyPayload,
  recipients: string[],
): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required for resend provider");
  const subject = leadSubject(payload);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: notifyFrom(),
      to: recipients,
      subject,
      text: leadBodyText(payload),
    }),
  });
  const response = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${JSON.stringify(response)}`);
  }
  return {
    mode: "send",
    provider: "resend",
    to: recipients,
    from: notifyFrom(),
    subject,
    payload,
    sent: true,
    dry_run: false,
    response,
  };
}

async function sendSendgrid(
  payload: LeadNotifyPayload,
  recipients: string[],
): Promise<NotifyResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY is required for sendgrid provider");
  const subject = leadSubject(payload);
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: notifyFrom() },
      subject,
      content: [{ type: "text/plain", value: leadBodyText(payload) }],
    }),
  });
  const text = await res.text();
  const response = text ? JSON.parse(text) : { ok: true };
  if (!res.ok) {
    throw new Error(`SendGrid HTTP ${res.status}: ${text}`);
  }
  return {
    mode: "send",
    provider: "sendgrid",
    to: recipients,
    from: notifyFrom(),
    subject,
    payload,
    sent: true,
    dry_run: false,
    response,
  };
}

async function sendSmtp(
  payload: LeadNotifyPayload,
  recipients: string[],
): Promise<NotifyResult> {
  // Prefer HTTP providers from the Next.js process; SMTP needs a relay URL or falls back to dry-run log.
  const smtpUrl = process.env.SMTP_URL || process.env.SMTP_HOST;
  if (!smtpUrl) {
    throw new Error(
      "SMTP_HOST/SMTP_URL unset — use resend/sendgrid from the web app, or set NOTIFY_EMAIL_MODE=dry-run",
    );
  }

  // Optional lightweight SMTP-over-HTTP bridge (e.g. transactional relay). Direct SMTP
  // sockets are awkward in serverless Next; prefer Resend/SendGrid for the dashboard path.
  const bridge = process.env.SMTP_HTTP_BRIDGE_URL;
  if (!bridge) {
    throw new Error(
      "Direct SMTP from Next.js is not supported; set NOTIFY_EMAIL_PROVIDER=resend|sendgrid or SMTP_HTTP_BRIDGE_URL",
    );
  }

  const subject = leadSubject(payload);
  const res = await fetch(bridge, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || "587"),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: notifyFrom(),
      to: recipients,
      subject,
      text: leadBodyText(payload),
    }),
  });
  if (!res.ok) {
    throw new Error(`SMTP bridge HTTP ${res.status}: ${await res.text()}`);
  }
  return {
    mode: "send",
    provider: "smtp",
    to: recipients,
    from: notifyFrom(),
    subject,
    payload,
    sent: true,
    dry_run: false,
  };
}

export async function sendLeadEmail(
  payload: LeadNotifyPayload,
): Promise<NotifyResult> {
  const recipients = notifyRecipients();
  const subject = leadSubject(payload);
  const base = {
    mode: notifyMode(),
    provider: notifyProvider(),
    to: recipients,
    from: notifyFrom(),
    subject,
    payload,
  };

  if (!recipients.length) {
    return {
      ...base,
      sent: false,
      skipped: true,
      reason: "NOTIFY_EMAIL_TO is empty",
    };
  }

  if (base.mode === "dry-run") {
    console.info(
      "NOTIFY dry-run (not sent):",
      JSON.stringify({ ...base, sent: false, dry_run: true }),
    );
    return { ...base, sent: false, dry_run: true };
  }

  if (base.provider === "resend") return sendResend(payload, recipients);
  if (base.provider === "sendgrid") return sendSendgrid(payload, recipients);
  return sendSmtp(payload, recipients);
}

export async function maybeNotifyLead(
  payload: LeadNotifyPayload & { created?: boolean },
): Promise<NotifyResult | null> {
  const created = payload.created !== false;
  if (!shouldNotify(payload.ai_assessment, created)) return null;
  try {
    return await sendLeadEmail(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Lead email notification failed for ${payload.ref}:`, message);
    return {
      mode: notifyMode(),
      provider: notifyProvider(),
      to: notifyRecipients(),
      from: notifyFrom(),
      subject: leadSubject(payload),
      payload,
      sent: false,
      error: message,
    };
  }
}
