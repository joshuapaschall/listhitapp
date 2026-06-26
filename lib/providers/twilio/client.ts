import "server-only"

import twilio, { type Twilio } from "twilio"

// Central, server-only Twilio client for ListHit's parent (ISV) account.
//
// Credentials are read LAZILY inside the accessor functions — never at module
// load time — so a deploy that hasn't set the Twilio env vars yet still builds
// and boots. Nothing throws until something actually asks for the client.
//
// Env (ListHit parent account, API-key auth):
//   LISTHIT_TWILIO_ACCOUNT_SID         — parent account SID (ACxxxx)
//   LISTHIT_TWILIO_API_KEY_SID         — standard API key SID (SKxxxx)
//   LISTHIT_TWILIO_API_KEY_SECRET      — API key secret
//   LISTHIT_TWILIO_PRIMARY_PROFILE_SID — ListHit's primary customer profile (BUxxxx)

let cachedClient: Twilio | null = null

export function getTwilioClient(): Twilio {
  if (cachedClient) return cachedClient

  const accountSid = process.env.LISTHIT_TWILIO_ACCOUNT_SID
  const apiKeySid = process.env.LISTHIT_TWILIO_API_KEY_SID
  const apiKeySecret = process.env.LISTHIT_TWILIO_API_KEY_SECRET

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    throw new Error(
      "Twilio is not configured: set LISTHIT_TWILIO_ACCOUNT_SID, " +
        "LISTHIT_TWILIO_API_KEY_SID, and LISTHIT_TWILIO_API_KEY_SECRET.",
    )
  }

  cachedClient = twilio(apiKeySid, apiKeySecret, { accountSid })
  return cachedClient
}

export function getListHitPrimaryProfileSid(): string {
  const sid = process.env.LISTHIT_TWILIO_PRIMARY_PROFILE_SID
  if (!sid) {
    throw new Error(
      "Twilio is not configured: set LISTHIT_TWILIO_PRIMARY_PROFILE_SID.",
    )
  }
  return sid
}
