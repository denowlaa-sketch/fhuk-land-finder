import {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  twilioPublicBaseUrl,
  twilioStatus,
} from "./env";

export interface PlaceCallResult {
  sid: string;
  status: string;
}

export async function placeTwilioCall(opts: {
  toE164: string;
  attemptId: string;
}): Promise<PlaceCallResult> {
  const status = twilioStatus();
  if (!status.ready) {
    throw new Error(
      "Twilio live dials not ready — set TWILIO_* vars and TWILIO_LIVE_DIALS=true",
    );
  }

  const accountSid = twilioAccountSid();
  const authToken = twilioAuthToken();
  const from = twilioPhoneNumber();
  const base = twilioPublicBaseUrl();
  const voiceUrl = `${base}/api/twilio/voice/${opts.attemptId}/intro`;
  const statusCallback = `${base}/api/twilio/voice/${opts.attemptId}/status`;

  const body = new URLSearchParams({
    To: opts.toE164,
    From: from,
    Url: voiceUrl,
    Method: "POST",
    StatusCallback: statusCallback,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "completed answered busy no-answer failed canceled",
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    message?: string;
  };
  if (!res.ok || !json.sid) {
    throw new Error(
      `Twilio create call failed (${res.status}): ${json.message || JSON.stringify(json)}`,
    );
  }
  return { sid: json.sid, status: json.status || "queued" };
}
