import "server-only"

import twilio from "twilio"

import { encryptSecret } from "@/lib/crypto/secret-box"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { supabaseAdmin } from "@/lib/supabase"
import { clearCredentialsCache, getOrgCredentials } from "@/lib/twilio/credentials"
import { clearOrgClientCache } from "@/lib/twilio/org-client"
import { getParentAccountClient } from "@/lib/twilio/parent"

// Every non-owner org gets its own Twilio subaccount. Both functions here are
// idempotent so a platform admin can re-run them after a partial failure.

const friendlyNameFor = (orgId: string) => `listhit-org:${orgId}`

export async function ensureOrgSubaccount(orgId: string): Promise<{ subaccountSid: string }> {
  if (!orgId) throw new Error("orgId is required.")
  if (isOrgTelnyxPinnedEnv(orgId)) {
    throw new Error("The owner org uses Telnyx and never gets a Twilio subaccount.")
  }

  const existing = await getOrgCredentials(orgId)
  if (existing) return { subaccountSid: existing.subaccountSid }

  const parent = getParentAccountClient()
  const friendlyName = friendlyNameFor(orgId)

  // Adopt a subaccount a previous run created but failed to record.
  const matches = await parent.api.v2010.accounts.list({ friendlyName, limit: 20 })
  const adopted = matches.find((a) => a.friendlyName === friendlyName && a.status !== "closed")
  const account = adopted ?? (await parent.api.v2010.accounts.create({ friendlyName }))

  const { error } = await supabaseAdmin.from("org_twilio_credentials").insert({
    org_id: orgId,
    subaccount_sid: account.sid,
    auth_token_enc: encryptSecret(account.authToken),
  })
  if (error) throw new Error(`Failed to store Twilio credentials: ${error.message}`)

  const { error: orgTwilioError } = await supabaseAdmin
    .from("org_twilio")
    .upsert(
      { org_id: orgId, subaccount_sid: account.sid, updated_at: new Date().toISOString() },
      { onConflict: "org_id" },
    )
  if (orgTwilioError) throw new Error(`Failed to record subaccount on org_twilio: ${orgTwilioError.message}`)

  clearCredentialsCache(orgId)
  clearOrgClientCache(orgId)
  return { subaccountSid: account.sid }
}

function voiceTwimlUrl() {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")
  if (!base) throw new Error("Set NEXT_PUBLIC_BASE_URL (or NEXT_PUBLIC_SITE_URL) before creating voice credentials.")
  return `${base}/api/webhooks/twilio-voice-twiml`
}

// Browser voice Access Tokens must be signed with a Standard API key created
// INSIDE the subaccount and point at a TwiML App in that same subaccount.
export async function ensureOrgVoiceCredentials(orgId: string): Promise<{ apiKeySid: string; twimlAppSid: string }> {
  const creds = await getOrgCredentials(orgId)
  if (!creds) throw new Error("Create the org's Twilio subaccount first.")

  const sub = twilio(creds.subaccountSid, creds.authToken)
  let apiKeySid = creds.apiKeySid
  let twimlAppSid = creds.twimlAppSid

  if (!apiKeySid || !creds.apiKeySecret) {
    const key = await sub.iam.v1.newApiKey.create({ accountSid: creds.subaccountSid, friendlyName: "listhit-voice" })
    const { error } = await supabaseAdmin
      .from("org_twilio_credentials")
      .update({ api_key_sid: key.sid, api_key_secret_enc: encryptSecret(key.secret), updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
    if (error) throw new Error(`Failed to store the voice API key: ${error.message}`)
    apiKeySid = key.sid
  }

  if (!twimlAppSid) {
    const app = await sub.applications.create({
      friendlyName: "ListHit voice",
      voiceUrl: voiceTwimlUrl(),
      voiceMethod: "POST",
    })
    const { error } = await supabaseAdmin
      .from("org_twilio_credentials")
      .update({ twiml_app_sid: app.sid, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
    if (error) throw new Error(`Failed to store the TwiML app: ${error.message}`)
    twimlAppSid = app.sid
  }

  clearCredentialsCache(orgId)
  return { apiKeySid, twimlAppSid }
}
