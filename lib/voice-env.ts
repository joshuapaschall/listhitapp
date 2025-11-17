export const TELNYX_API_URL =
  process.env.TELNYX_API_URL || "https://api.telnyx.com/v2";

export const TELNYX_DEBUG =
  (process.env.TELNYX_DEBUG ?? "") !== "" && process.env.TELNYX_DEBUG !== "0";

export function getTelnyxApiKey(): string {
  return process.env.TELNYX_API_KEY || "";
}

export function getCallControlAppId(): string {
  return (
    process.env.TELNYX_CALL_CONTROL_APP_ID ||
    process.env.TELNYX_VOICE_CONNECTION_ID ||
    process.env.CALL_CONTROL_APP_ID ||
    process.env.VOICE_CONNECTION_ID ||
    ""
  );
}

export function getSipCredentialConnectionId(): string {
  return (
    process.env.TELNYX_SIP_CREDENTIAL_CONNECTION_ID ||
    process.env.TELNYX_SIP_CONNECTION_ID ||
    process.env.SIP_CREDENTIAL_CONNECTION_ID ||
    process.env.SIP_CONNECTION_ID ||
    ""
  );
}
