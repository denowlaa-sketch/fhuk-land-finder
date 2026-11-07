import { createHmac, timingSafeEqual } from "node:crypto";
import { facebookAppSecret, facebookPageAccessToken } from "./env";

export interface GraphLeadPayload {
  id?: string;
  created_time?: string;
  field_data?: Array<{ name?: string; values?: string[] }>;
  ad_id?: string;
  form_id?: string;
  [key: string]: unknown;
}

/** Optional X-Hub-Signature-256 verification when FACEBOOK_APP_SECRET is set. */
export function verifyFacebookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = facebookAppSecret();
  if (!secret) return true; // optional when unset
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function fetchFacebookLead(
  leadgenId: string,
): Promise<GraphLeadPayload> {
  const token = facebookPageAccessToken();
  if (!token) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN is not configured");
  }
  const url = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", "id,created_time,field_data,ad_id,form_id");

  const res = await fetch(url.toString(), { method: "GET" });
  const body = (await res.json().catch(() => ({}))) as GraphLeadPayload & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      `Graph lead fetch failed (${res.status}): ${body.error?.message || JSON.stringify(body)}`,
    );
  }
  return body;
}
