import "server-only"

// The shared parent-account API-key client that used to live here is gone: every
// tenant resource lives in the tenant's own subaccount (getTwilioClientForOrg in
// lib/twilio/org-client.ts), and subaccount management uses the parent auth token
// (lib/twilio/parent.ts).
//
// Env:
//   LISTHIT_TWILIO_PRIMARY_PROFILE_SID — ListHit's primary customer profile (BUxxxx)

export function getListHitPrimaryProfileSid(): string {
  const sid = process.env.LISTHIT_TWILIO_PRIMARY_PROFILE_SID
  if (!sid) {
    throw new Error(
      "Twilio is not configured: set LISTHIT_TWILIO_PRIMARY_PROFILE_SID.",
    )
  }
  return sid
}
