import { createHmac, timingSafeEqual } from "node:crypto";
import { twilioAuthToken } from "./env";

/**
 * Validate X-Twilio-Signature (HMAC-SHA1 of URL + sorted POST params).
 * When auth token unset, reject (live webhooks must be authenticated).
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const token = twilioAuthToken();
  if (!token || !signature) return false;

  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  const expected = createHmac("sha1", token)
    .update(url + sorted, "utf8")
    .digest("base64");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
