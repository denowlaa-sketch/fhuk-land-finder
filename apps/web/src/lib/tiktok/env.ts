/**
 * TikTok Lead Generation env helpers.
 * Secrets stay in env — never commit real values.
 */

function truthy(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function tiktokVerifyToken(): string {
  return (process.env.TIKTOK_VERIFY_TOKEN || "").trim();
}

export function tiktokAccessToken(): string {
  return (process.env.TIKTOK_ACCESS_TOKEN || "").trim();
}

export function tiktokAppSecret(): string {
  return (process.env.TIKTOK_APP_SECRET || "").trim();
}

export function tiktokAdvertiserId(): string {
  return (process.env.TIKTOK_ADVERTISER_ID || "").trim();
}

/** Simulate endpoint: always on in non-production; prod needs explicit flag. */
export function tiktokAllowSimulate(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return truthy(process.env.TIKTOK_ALLOW_SIMULATE, false);
}

export function tiktokConfigStatus() {
  const verifyToken = Boolean(tiktokVerifyToken());
  const accessToken = Boolean(tiktokAccessToken());
  const appSecret = Boolean(tiktokAppSecret());
  const advertiserId = Boolean(tiktokAdvertiserId());
  return {
    verifyTokenConfigured: verifyToken,
    accessTokenConfigured: accessToken,
    appSecretConfigured: appSecret,
    advertiserIdConfigured: advertiserId,
    allowSimulate: tiktokAllowSimulate(),
    /** Webhook verify works with verify token alone; Graph fetch needs access token. */
    webhookVerifyReady: verifyToken,
    /** Full lead fetch from TikTok API when webhook only sends lead_id. */
    leadFetchReady: accessToken && advertiserId,
    /** Stub mode: accept webhook payloads that already include form fields. */
    ingestStubReady: true,
  };
}
