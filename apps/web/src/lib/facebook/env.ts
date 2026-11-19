/**
 * Meta / Facebook Instant Form env helpers.
 * Secrets stay in env — never commit real values.
 */

function truthy(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function facebookVerifyToken(): string {
  return (process.env.FACEBOOK_VERIFY_TOKEN || "").trim();
}

export function facebookPageAccessToken(): string {
  return (process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
}

export function facebookAppSecret(): string {
  return (process.env.FACEBOOK_APP_SECRET || "").trim();
}

/** Simulate endpoint: always on in non-production; prod needs explicit flag. */
export function facebookAllowSimulate(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return truthy(process.env.FACEBOOK_ALLOW_SIMULATE, false);
}

export function facebookConfigStatus() {
  const verifyToken = Boolean(facebookVerifyToken());
  const pageToken = Boolean(facebookPageAccessToken());
  const appSecret = Boolean(facebookAppSecret());
  return {
    verifyTokenConfigured: verifyToken,
    pageAccessTokenConfigured: pageToken,
    appSecretConfigured: appSecret,
    allowSimulate: facebookAllowSimulate(),
    /** Meta hub.verify_token challenge works with verify token alone. */
    webhookVerifyReady: verifyToken,
    /** Graph lead fetch for Instant Form answers needs page access token. */
    leadFetchReady: pageToken,
    /** Both verify + page token present (does not prove token is unexpired). */
    webhookReady: verifyToken && pageToken,
  };
}
