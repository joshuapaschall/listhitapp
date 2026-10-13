import "server-only"

import twilio from "twilio"

import { getCredentialsBySubaccountSid, refreshSubaccountAuthToken } from "@/lib/twilio/credentials"
import { getParentAccountSid, getParentAuthToken } from "@/lib/twilio/parent"

// One verifier for every Twilio webhook. Twilio signs a webhook with the auth
// token of the account that owns the resource — the tenant's subaccount for
// tenant numbers, the parent for legacy parent-owned numbers — so the AccountSid
// in the payload picks the token, and a verified subaccount tells us the org.

export type VerifiedTwilioWebhook =
  | { ok: true; accountSid: string; account: "parent" | "subaccount"; orgId: string | null }
  | { ok: false; reason: "missing_signature" | "missing_account" | "unknown_account" | "bad_signature" }

function safeParentSid() {
  try {
    return getParentAccountSid()
  } catch {
    return null
  }
}

export async function verifyTwilioWebhook(input: {
  signature: string
  url: string
  params: Record<string, string>
}): Promise<VerifiedTwilioWebhook> {
  const { signature, url, params } = input
  if (!signature) return { ok: false, reason: "missing_signature" }

  const accountSid = params.AccountSid
  if (!accountSid) return { ok: false, reason: "missing_account" }

  const parentSid = safeParentSid()
  if (parentSid && accountSid === parentSid) {
    let token: string
    try {
      token = getParentAuthToken()
    } catch {
      return { ok: false, reason: "unknown_account" }
    }
    return twilio.validateRequest(token, signature, url, params)
      ? { ok: true, accountSid, account: "parent", orgId: null }
      : { ok: false, reason: "bad_signature" }
  }

  const creds = await getCredentialsBySubaccountSid(accountSid)
  if (!creds) return { ok: false, reason: "unknown_account" }

  if (twilio.validateRequest(creds.authToken, signature, url, params)) {
    return { ok: true, accountSid, account: "subaccount", orgId: creds.orgId }
  }

  // The subaccount's token may have been rotated — fetch it once and retry.
  let refreshed = null
  try {
    refreshed = await refreshSubaccountAuthToken(creds.orgId)
  } catch (err) {
    console.warn("[twilio-webhook] auth token refresh failed", { accountSid }, err instanceof Error ? err.message : err)
  }
  if (refreshed && twilio.validateRequest(refreshed.authToken, signature, url, params)) {
    return { ok: true, accountSid, account: "subaccount", orgId: creds.orgId }
  }
  return { ok: false, reason: "bad_signature" }
}
