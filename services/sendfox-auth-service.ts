import { createLogger } from "@/lib/logger"
import { supabaseAdmin } from "@/lib/supabase"
import { getSendfoxToken } from "@/lib/sendfox-env"

const log = createLogger("sendfox-auth-service")

export interface SendFoxTokenResponse {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
}

export interface StoredSendFoxToken {
  user_id: string
  access_token: string
  refresh_token: string | null
  token_type: string | null
  scope: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at?: string
  updated_at?: string
}

const AUTHORIZE_BASE = "https://sendfox.com/oauth/authorize"
const TOKEN_URL = "https://sendfox.com/oauth/token"

function getClientId() {
  return process.env.SENDFOX_CLIENT_ID || ""
}

function getClientSecret() {
  return process.env.SENDFOX_CLIENT_SECRET || ""
}

export function buildAuthorizeUrl(state: string, redirectUri: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error("Missing SENDFOX_CLIENT_ID")
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email",
    state,
  })
  return `${AUTHORIZE_BASE}?${params.toString()}`
}

export function getDefaultSendFoxToken() {
  return getSendfoxToken()
}

function computeExpiresAt(expiresIn?: number) {
  if (!expiresIn) return null
  const expires = new Date()
  expires.setSeconds(expires.getSeconds() + expiresIn)
  return expires.toISOString()
}

export async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const clientId = getClientId()
  const clientSecret = getClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("Missing SendFox OAuth client configuration")
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    log("error", "SendFox auth code exchange failed", { status: res.status, text })
    throw new Error("Failed to exchange SendFox authorization code")
  }
  const data = text ? (JSON.parse(text) as SendFoxTokenResponse) : null
  if (!data?.access_token) {
    throw new Error("Missing access token in SendFox response")
  }
  return data
}

export async function refreshSendFoxToken(refreshToken: string) {
  const clientId = getClientId()
  const clientSecret = getClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("Missing SendFox OAuth client configuration")
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    log("error", "SendFox token refresh failed", { status: res.status, text })
    throw new Error("Failed to refresh SendFox token")
  }
  const data = text ? (JSON.parse(text) as SendFoxTokenResponse) : null
  if (!data?.access_token) throw new Error("Missing access token during refresh")
  return data
}

export async function saveSendFoxTokens(userId: string, payload: SendFoxTokenResponse) {
  if (!supabaseAdmin) throw new Error("Supabase admin not configured")
  const expiresAt = computeExpiresAt(payload.expires_in)
  const { error } = await supabaseAdmin
    .from("sendfox_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token || null,
        token_type: payload.token_type || "bearer",
        scope: payload.scope || null,
        expires_at: expiresAt,
        revoked_at: null,
      },
      { onConflict: "user_id" },
    )
  if (error) {
    log("error", "Failed to persist SendFox tokens", { userId, error })
    throw error
  }
  return {
    user_id: userId,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    token_type: payload.token_type || null,
    scope: payload.scope || null,
    expires_at: expiresAt,
    revoked_at: null,
  }
}

export async function getActiveSendFoxToken(userId: string): Promise<StoredSendFoxToken | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from("sendfox_tokens")
    .select("user_id,access_token,refresh_token,token_type,scope,expires_at,revoked_at,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    log("error", "Failed to load SendFox token", { userId, error })
    return null
  }
  if (!data || data.revoked_at) return null
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null
  const refreshToken = data.refresh_token
  if (expiresAt && expiresAt < Date.now() + 60 * 1000 && refreshToken) {
    try {
      const refreshed = await refreshSendFoxToken(refreshToken)
      const saved = await saveSendFoxTokens(userId, refreshed)
      return saved
    } catch (err) {
      log("error", "SendFox refresh failed", { userId, error: err })
      await supabaseAdmin
        .from("sendfox_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", userId)
      return null
    }
  }
  return data as StoredSendFoxToken
}

export async function revokeSendFoxToken(userId: string) {
  if (!supabaseAdmin) throw new Error("Supabase admin not configured")
  const { error } = await supabaseAdmin
    .from("sendfox_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
  if (error) {
    log("error", "Failed to revoke SendFox token", { userId, error })
    throw error
  }
}
