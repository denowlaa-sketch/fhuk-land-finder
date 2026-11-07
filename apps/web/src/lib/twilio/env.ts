/**
 * Twilio live-dial env. Live path refuses unless TWILIO_LIVE_DIALS=true
 * and all account vars are set.
 */

function truthy(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function twilioAccountSid(): string {
  return (process.env.TWILIO_ACCOUNT_SID || "").trim();
}

export function twilioAuthToken(): string {
  return (process.env.TWILIO_AUTH_TOKEN || "").trim();
}

export function twilioPhoneNumber(): string {
  return (process.env.TWILIO_PHONE_NUMBER || "").trim();
}

export function twilioPublicBaseUrl(): string {
  return (process.env.TWILIO_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
}

export function twilioLiveDialsEnabled(): boolean {
  return truthy(process.env.TWILIO_LIVE_DIALS, false);
}

export function twilioConfigured(): boolean {
  return Boolean(
    twilioAccountSid() &&
      twilioAuthToken() &&
      twilioPhoneNumber() &&
      twilioPublicBaseUrl(),
  );
}

/** ready = all Twilio vars set AND live dials explicitly enabled. */
export function twilioStatus() {
  const configured = twilioConfigured();
  const live = twilioLiveDialsEnabled();
  return {
    configured,
    liveDials: live,
    ready: configured && live,
    accountSidSet: Boolean(twilioAccountSid()),
    authTokenSet: Boolean(twilioAuthToken()),
    phoneNumberSet: Boolean(twilioPhoneNumber()),
    publicBaseUrlSet: Boolean(twilioPublicBaseUrl()),
    phoneNumber: twilioPhoneNumber() || null,
    publicBaseUrl: twilioPublicBaseUrl() || null,
  };
}
