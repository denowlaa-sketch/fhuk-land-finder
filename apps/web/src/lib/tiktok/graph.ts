import crypto from "crypto";
import {
  tiktokAccessToken,
  tiktokAdvertiserId,
  tiktokAppSecret,
} from "./env";

/**
 * Optional TikTok webhook signature check when TIKTOK_APP_SECRET is set.
 * Accepts hex HMAC-SHA256 of raw body (header x-tiktok-signature or
 * x-tt-signature). When secret unset, verification is skipped (dev stub).
 */
export function verifyTikTokSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = tiktokAppSecret();
  if (!secret) return true;
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface TikTokLeadFetchResult {
  id: string;
  field_data: Array<{ name?: string; values?: string[]; value?: string }>;
  form_id?: string | null;
  ad_id?: string | null;
  created_time?: string | null;
  raw?: Record<string, unknown>;
}

/**
 * Fetch a TikTok lead by id via Business API when token + advertiser are set.
 * Endpoint shape follows TikTok Lead Generation get-lead patterns; if the
 * live API path differs, webhook payloads that embed form fields still ingest.
 */
export async function fetchTikTokLead(
  leadId: string,
): Promise<TikTokLeadFetchResult> {
  const token = tiktokAccessToken();
  const advertiserId = tiktokAdvertiserId();
  if (!token || !advertiserId) {
    throw new Error(
      "TIKTOK_ACCESS_TOKEN and TIKTOK_ADVERTISER_ID required to fetch lead details",
    );
  }

  const url = new URL(
    "https://business-api.tiktok.com/open_api/v1.3/page/lead/get/",
  );
  url.searchParams.set("advertiser_id", advertiserId);
  url.searchParams.set("lead_id", leadId);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `TikTok lead fetch failed (${res.status}): ${JSON.stringify(json)}`,
    );
  }

  const data =
    (json.data as Record<string, unknown> | undefined) ??
    (json as Record<string, unknown>);
  const lead =
    (data.lead as Record<string, unknown> | undefined) ??
    (Array.isArray(data.leads)
      ? (data.leads[0] as Record<string, unknown>)
      : data);

  const changes =
    (lead.changes as Array<Record<string, unknown>> | undefined) ??
    (lead.field_data as Array<Record<string, unknown>> | undefined) ??
    (lead.form_data as Array<Record<string, unknown>> | undefined) ??
    [];

  const field_data = changes.map((row) => {
    const name = String(row.field || row.name || "");
    if (Array.isArray(row.values)) {
      return { name, values: row.values.map(String) };
    }
    return { name, value: String(row.value ?? row.field_value ?? "") };
  });

  return {
    id: String(lead.lead_id || lead.id || leadId),
    field_data,
    form_id: lead.page_id
      ? String(lead.page_id)
      : lead.form_id
        ? String(lead.form_id)
        : null,
    ad_id: lead.ad_id ? String(lead.ad_id) : null,
    created_time: lead.create_time
      ? String(lead.create_time)
      : lead.created_time
        ? String(lead.created_time)
        : null,
    raw: lead,
  };
}
