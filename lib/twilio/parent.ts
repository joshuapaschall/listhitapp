import "server-only"

import twilio, { type Twilio } from "twilio"

// ListHit's parent (ISV) Twilio account, authenticated with the parent auth
// token. Only subaccount management (/2010-04-01/Accounts) and validating
// webhooks for legacy parent-owned numbers need it — standard API keys cannot
// reach /Accounts, and every tenant resource lives in that tenant's subaccount.
//
// THIS IS THE ONLY FILE THAT MAY READ LISTHIT_TWILIO_AUTH_TOKEN.
// Read lazily so a deploy without Twilio env still builds and boots.

let cachedClient: Twilio | null = null

export function getParentAccountSid(): string {
  const sid = process.env.LISTHIT_TWILIO_ACCOUNT_SID
  if (!sid) throw new Error("Twilio is not configured: set LISTHIT_TWILIO_ACCOUNT_SID.")
  return sid
}

export function getParentAuthToken(): string {
  const token = process.env.LISTHIT_TWILIO_AUTH_TOKEN
  if (!token) throw new Error("Twilio is not configured: set LISTHIT_TWILIO_AUTH_TOKEN.")
  return token
}

export function getParentAccountClient(): Twilio {
  if (cachedClient) return cachedClient
  cachedClient = twilio(getParentAccountSid(), getParentAuthToken())
  return cachedClient
}
