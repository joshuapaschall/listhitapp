import "server-only"

import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box"
import { supabaseAdmin } from "@/lib/supabase"
import { getParentAccountClient } from "@/lib/twilio/parent"

// Per-org Twilio subaccount credentials, decrypted from org_twilio_credentials
// (service_role only). Decrypted secrets are returned to the caller that needs
// them and never logged.

export type OrgTwilioCredentials = {
  orgId: string
  subaccountSid: string
  authToken: string
  apiKeySid: string | null
  apiKeySecret: string | null
  twimlAppSid: string | null
}

type CredentialsRow = {
  org_id: string
  subaccount_sid: string
  auth_token_enc: string
  api_key_sid: string | null
  api_key_secret_enc: string | null
  twiml_app_sid: string | null
}

const COLUMNS = "org_id,subaccount_sid,auth_token_enc,api_key_sid,api_key_secret_enc,twiml_app_sid"
const TTL_MS = 5 * 60 * 1000

type CacheEntry = { value: OrgTwilioCredentials; expiresAt: number }
const byOrg = new Map<string, CacheEntry>()
const byAccount = new Map<string, CacheEntry>()

function fromRow(row: CredentialsRow): OrgTwilioCredentials {
  return {
    orgId: row.org_id,
    subaccountSid: row.subaccount_sid,
    authToken: decryptSecret(row.auth_token_enc),
    apiKeySid: row.api_key_sid ?? null,
    apiKeySecret: row.api_key_secret_enc ? decryptSecret(row.api_key_secret_enc) : null,
    twimlAppSid: row.twiml_app_sid ?? null,
  }
}

function remember(creds: OrgTwilioCredentials) {
  const entry = { value: creds, expiresAt: Date.now() + TTL_MS }
  byOrg.set(creds.orgId, entry)
  byAccount.set(creds.subaccountSid, entry)
}

function fresh(entry: CacheEntry | undefined) {
  return entry && entry.expiresAt > Date.now() ? entry.value : null
}

export function clearCredentialsCache(orgId?: string) {
  if (!orgId) {
    byOrg.clear()
    byAccount.clear()
    return
  }
  const entry = byOrg.get(orgId)
  byOrg.delete(orgId)
  if (entry) byAccount.delete(entry.value.subaccountSid)
  for (const [sid, e] of byAccount) if (e.value.orgId === orgId) byAccount.delete(sid)
}

async function load(column: "org_id" | "subaccount_sid", value: string) {
  const { data, error } = await supabaseAdmin
    .from("org_twilio_credentials")
    .select(COLUMNS)
    .eq(column, value)
    .maybeSingle<CredentialsRow>()
  if (error) throw new Error(`org_twilio_credentials lookup failed: ${error.message}`)
  if (!data) return null
  const creds = fromRow(data)
  remember(creds)
  return creds
}

export async function getOrgCredentials(orgId: string): Promise<OrgTwilioCredentials | null> {
  if (!orgId) return null
  return fresh(byOrg.get(orgId)) ?? load("org_id", orgId)
}

export async function getCredentialsBySubaccountSid(accountSid: string): Promise<OrgTwilioCredentials | null> {
  if (!accountSid) return null
  return fresh(byAccount.get(accountSid)) ?? load("subaccount_sid", accountSid)
}

// Twilio lets an operator rotate a subaccount's auth token; webhooks are then
// signed with the new one. Pull the current token with the parent client and
// re-store it.
export async function refreshSubaccountAuthToken(orgId: string): Promise<OrgTwilioCredentials | null> {
  const { data, error } = await supabaseAdmin
    .from("org_twilio_credentials")
    .select("subaccount_sid")
    .eq("org_id", orgId)
    .maybeSingle<{ subaccount_sid: string }>()
  if (error) throw new Error(`org_twilio_credentials lookup failed: ${error.message}`)
  if (!data) return null

  const account = await getParentAccountClient().api.v2010.accounts(data.subaccount_sid).fetch()
  const { error: updateError } = await supabaseAdmin
    .from("org_twilio_credentials")
    .update({ auth_token_enc: encryptSecret(account.authToken), updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
  if (updateError) throw new Error(`org_twilio_credentials update failed: ${updateError.message}`)

  clearCredentialsCache(orgId)
  return getOrgCredentials(orgId)
}
