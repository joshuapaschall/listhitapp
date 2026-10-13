import "server-only"

import twilio, { type Twilio } from "twilio"

import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { getCredentialsBySubaccountSid, getOrgCredentials } from "@/lib/twilio/credentials"
import { getParentAccountSid, getParentAuthToken } from "@/lib/twilio/parent"

// The Twilio client for a tenant: always the org's OWN subaccount, authenticated
// with that subaccount's auth token. Messaging, Trust Hub, voice and Event
// Streams resources all live in the subaccount, and parent-account API keys are
// denied on them, so there is no shared client to fall back to.

export class TwilioNotProvisionedError extends Error {
  readonly code = "twilio_not_provisioned"
  constructor(message = "This organization doesn't have a Twilio account yet.") {
    super(message)
    this.name = "TwilioNotProvisionedError"
  }
}

const TTL_MS = 5 * 60 * 1000
const clients = new Map<string, { client: Twilio; expiresAt: number }>()

export function clearOrgClientCache(orgId?: string) {
  if (orgId) clients.delete(orgId)
  else clients.clear()
}

export async function getTwilioClientForOrg(orgId: string): Promise<Twilio> {
  if (!orgId) throw new TwilioNotProvisionedError("No organization for the Twilio client.")
  if (isOrgTelnyxPinnedEnv(orgId)) {
    throw new Error("The owner org uses Telnyx and has no Twilio client.")
  }

  const cached = clients.get(orgId)
  if (cached && cached.expiresAt > Date.now()) return cached.client

  const creds = await getOrgCredentials(orgId)
  if (!creds) throw new TwilioNotProvisionedError()

  const client = twilio(creds.subaccountSid, creds.authToken)
  clients.set(orgId, { client, expiresAt: Date.now() + TTL_MS })
  return client
}

function basic(sid: string, token: string) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`
}

// HTTP Basic auth for fetching media (recordings) owned by a given account.
// Known subaccounts use their own token; the parent SID uses the parent pair
// (legacy parent-owned numbers). Anything else is unknown → null.
export async function getTwilioBasicAuthForAccount(accountSid: string): Promise<string | null> {
  if (!accountSid) return null

  let parentSid: string | null = null
  try {
    parentSid = getParentAccountSid()
  } catch {
    parentSid = null
  }
  if (parentSid && accountSid === parentSid) {
    try {
      return basic(parentSid, getParentAuthToken())
    } catch {
      return null
    }
  }

  const creds = await getCredentialsBySubaccountSid(accountSid)
  return creds ? basic(creds.subaccountSid, creds.authToken) : null
}
