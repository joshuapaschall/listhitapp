import crypto from "crypto"

import { supabaseAdmin } from "@/lib/supabase"
import { TELNYX_API_URL, telnyxHeaders } from "@/lib/telnyx"
import { requireEnv } from "@/lib/env-check"
import {
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env"

export interface TelnyxCredential {
  id: string
  sip_username: string
  sip_password: string
  connection_id: string
  created_at: string
}

export interface AgentTelephonyCredential {
  id: string
  username: string
  password: string
}

export interface TelnyxWebRTCToken {
  token: string
  expires_at?: string
}

export class SipCredentialConnectionError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "SipCredentialConnectionError"
  }
}

export const SIP_CONNECTION_INVALID_MESSAGE =
  "TELNYX_SIP_CONNECTION_ID is not a SIP credential connection"

function warnIfConnectionIdsOverlap() {
  const callControlId = getCallControlAppId()
  const sipConnectionId = getSipCredentialConnectionId()

  if (
    callControlId &&
    sipConnectionId &&
    callControlId === sipConnectionId
  ) {
    console.warn(
      "WARN: TELNYX_SIP_CONNECTION_ID equals CALL_CONTROL_APP_ID — misconfiguration likely.",
    )
  }
}

function parseTelnyxError(
  status: number,
  text: string,
  json: any,
): Error {
  const message =
    json?.errors?.[0]?.detail ||
    json?.errors?.[0]?.title ||
    json?.error ||
    text ||
    `Telnyx error (${status})`

  const normalized = message.toLowerCase()
  if (
    normalized.includes("connection") &&
    (normalized.includes("invalid") ||
      normalized.includes("credential connection") ||
      normalized.includes("sip credential"))
  ) {
    return new SipCredentialConnectionError(
      SIP_CONNECTION_INVALID_MESSAGE,
      400,
    )
  }

  return new Error(message)
}

const isLikelyJwt = (s: string) =>
  typeof s === "string" &&
  s.length > 20 &&
  s.split(".").length >= 3 &&
  /^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/.test(s)

export async function createCredential(): Promise<TelnyxCredential> {
  const sipConnectionId = getSipCredentialConnectionId()

  if (!getTelnyxApiKey()) {
    throw new Error("Telnyx not configured")
  }

  if (!sipConnectionId) {
    throw new SipCredentialConnectionError(
      "Missing SIP credential connection id (TELNYX_SIP_CONNECTION_ID).",
      500,
    )
  }

  warnIfConnectionIdsOverlap()

  console.log("🔑 Creating credential with connection_id:", sipConnectionId)

  const res = await fetch(`${TELNYX_API_URL}/telephony_credentials`, {
    method: "POST",
    headers: telnyxHeaders(),
    body: JSON.stringify({
      name: `AutoCred-${Date.now()}`,
      connection_id: sipConnectionId,
    }),
  })
  const raw = await res.text().catch(() => "")
  let data: any = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    throw parseTelnyxError(res.status, raw, data)
  }

  const cred = (data?.data || data) as TelnyxCredential

  if (cred?.connection_id && cred.connection_id !== sipConnectionId) {
    console.warn(
      "[telnyx] Credential connection mismatch",
      cred.connection_id,
      sipConnectionId,
    )
    throw new Error("Telnyx returned credential for unexpected Call Control App ID")
  }

  console.log("🔑 Created credential:", {
    username: cred.sip_username,
    connection_id: cred.connection_id,
    expected_connection_id: sipConnectionId,
  })

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from("telnyx_credentials").insert({
      id: cred.id,
      sip_username: cred.sip_username,
      sip_password: cred.sip_password,
      connection_id: cred.connection_id || sipConnectionId,
    })

    if (error) {
      console.error("[telnyx] Failed to persist credential", error)
    }
  }

  return cred
}

export async function cleanupCredentials(): Promise<number> {
  if (!getTelnyxApiKey()) throw new Error("Telnyx not configured")
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabaseAdmin
    ?.from("telnyx_credentials")
    .select("id")
    .lt("created_at", cutoff)
  const list = data || []
  for (const row of list) {
    await fetch(`${TELNYX_API_URL}/telephony_credentials/${row.id}`, {
      method: "DELETE",
      headers: telnyxHeaders(),
    }).catch(() => {})
    await supabaseAdmin?.from("telnyx_credentials").delete().eq("id", row.id)
  }
  return list.length
}

function generateSipUsername() {
  const random = crypto.randomInt(1000, 9999)
  return `sip_${random}_${crypto.randomBytes(2).toString("hex")}`
}

function strongPassword(): string {
  const base = crypto.randomBytes(24).toString("base64")
  return (
    base
      .replace(/[+/=]/g, "")
      .slice(0, 20) +
    "A" +
    "a" +
    "1" +
    "!"
  )
}

export async function createAgentTelephonyCredential({
  sipUsername,
}: { sipUsername?: string } = {}): Promise<AgentTelephonyCredential> {
  requireEnv("TELNYX_API_KEY")
  const sipConnectionId = getSipCredentialConnectionId()

  if (!sipConnectionId) {
    throw new SipCredentialConnectionError(
      "Missing SIP credential connection id (TELNYX_SIP_CONNECTION_ID).",
      500,
    )
  }

  warnIfConnectionIdsOverlap()

  let attempt = 0
  let lastError: Error | null = null

  while (attempt < 5) {
    const username = (sipUsername || generateSipUsername()).toLowerCase()
    const password = strongPassword()

    const resp = await fetch(`${TELNYX_API_URL}/telephony_credentials`, {
      method: "POST",
      headers: telnyxHeaders(),
      body: JSON.stringify({
        connection_id: sipConnectionId,
        username,
        password,
      }),
    })

    if (resp.ok) {
      const json = await resp.json()
      const id: string = json?.data?.id
      if (!id) {
        throw new Error("Telnyx response missing credential id")
      }

      const returnedConnectionId: string | undefined = json?.data?.connection_id
      if (returnedConnectionId && returnedConnectionId !== sipConnectionId) {
        console.warn(
          "[telnyx] Agent credential connection mismatch",
          returnedConnectionId,
          sipConnectionId,
        )
        throw new Error("Telnyx returned credential for unexpected Call Control App ID")
      }

      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from("telnyx_credentials")
          .insert({
            id,
            sip_username: username,
            sip_password: password,
            connection_id: returnedConnectionId || sipConnectionId,
          })

        if (error) {
          console.error("[telnyx] Failed to persist agent credential", error)
        }
      }

      return { id, username, password }
    }

    const text = await resp.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }

    const telnyxError = parseTelnyxError(resp.status, text, json)
    if (telnyxError instanceof SipCredentialConnectionError) {
      throw telnyxError
    }

    const normalizedSource = text || JSON.stringify(json || {})
    const normalized = normalizedSource.toLowerCase()
    if (
      resp.status === 409 ||
      resp.status === 422 ||
      normalized.includes("username")
    ) {
      lastError = new Error(
        `duplicate username: ${normalizedSource || "unknown error"}`,
      )
      sipUsername = undefined
      attempt += 1
      continue
    }

    throw new Error(
      `Telnyx create credential failed: ${resp.status} ${
        normalizedSource || ""
      }`,
    )
  }

  throw lastError || new Error("Unable to create unique Telnyx credential")
}

export async function deleteTelnyxCredential(id: string) {
  try {
    await fetch(`${TELNYX_API_URL}/telephony_credentials/${id}`, {
      method: "DELETE",
      headers: telnyxHeaders(),
    })
  } catch (error) {
    console.error("Failed to delete Telnyx credential", id, error)
  }
  try {
    await supabaseAdmin?.from("telnyx_credentials").delete().eq("id", id)
  } catch (error) {
    console.error("Failed to delete Telnyx credential record", id, error)
  }
}

export async function createWebRTCToken(
  telephonyCredentialId: string,
): Promise<TelnyxWebRTCToken> {
  if (!getTelnyxApiKey()) throw new Error("Missing TELNYX_API_KEY")
  if (!telephonyCredentialId) throw new Error("Missing telephony credential id")

  const url = `${TELNYX_API_URL}/telephony_credentials/${encodeURIComponent(
    telephonyCredentialId,
  )}/token`

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...telnyxHeaders(),
      Accept: "text/plain",
    },
  })

  const raw = await resp.text().catch(() => "")

  if (!resp.ok) {
    if (raw && !isLikelyJwt(raw)) {
      throw new Error(raw)
    }
    try {
      const json = raw ? JSON.parse(raw) : null
      if (json?.error) throw new Error(json.error)
    } catch (error) {
      if (error instanceof Error) throw error
    }
    throw new Error(`Telnyx token error (${resp.status})`)
  }

  if (!raw || !isLikelyJwt(raw)) {
    throw new Error("Telnyx token missing or invalid")
  }

  return { token: raw }
}
