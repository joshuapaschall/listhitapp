import { AsyncLocalStorage } from "async_hooks"
import { supabaseAdmin } from "@/lib/supabase"
import { getSendfoxToken } from "@/lib/sendfox-env"

const clientId = process.env.SENDFOX_CLIENT_ID || ""
const clientSecret = process.env.SENDFOX_CLIENT_SECRET || ""
const redirectUri =
  process.env.NEXT_PUBLIC_SENDFOX_REDIRECT_URI || process.env.SENDFOX_REDIRECT_URI || ""

const TOKEN_URL = "https://sendfox.com/oauth/token"
const AUTHORIZE_URL = "https://sendfox.com/oauth/authorize"

export interface SendfoxIntegration {
  id: string
  user_id: string
  provider: string
  access_token: string
  refresh_token?: string | null
  expires_at?: string | null
}

export interface SendfoxAuthContext {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  integrationId?: string | null
  userId?: string | null
  source?: "user" | "env"
}

export interface SendfoxTokenPayload {
  access_token: string
  refresh_token?: string | null
  expires_in?: number | null
}

const sendfoxAuthStore = new AsyncLocalStorage<SendfoxAuthContext>()

export function getSendfoxAuthContext() {
  return sendfoxAuthStore.getStore()
}

export function withSendfoxAuth<T>(context: SendfoxAuthContext, fn: () => Promise<T>) {
  const merged: SendfoxAuthContext = { ...context }
  return sendfoxAuthStore.run(merged, fn)
}

export function getDefaultSendfoxContext(): SendfoxAuthContext | null {
  const token = getSendfoxToken()
  if (!token) return null
  return { accessToken: token, source: "env" }
}

export function buildSendfoxContextFromIntegration(
  integration: SendfoxIntegration,
): SendfoxAuthContext {
  return {
    accessToken: integration.access_token,
    refreshToken: integration.refresh_token,
    expiresAt: integration.expires_at ?? undefined,
    integrationId: integration.id,
    userId: integration.user_id,
    source: "user",
  }
}

export function getSendfoxAuthorizationUrl(state: string) {
  if (!clientId || !redirectUri) {
    throw new Error("Missing SendFox OAuth configuration")
  }
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", "email")
  url.searchParams.set("state", state)
  return url.toString()
}

function computeExpiresAt(expiresIn?: number | null) {
  if (!expiresIn) return null
  return new Date(Date.now() + expiresIn * 1000).toISOString()
}

async function requestToken(body: URLSearchParams) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || "SendFox token request failed")
  }
  const data = (await res.json()) as SendfoxTokenPayload
  return data
}

export async function exchangeSendfoxCode(code: string) {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing SendFox OAuth configuration")
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  })
  const payload = await requestToken(body)
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? null,
    expires_at: computeExpiresAt(payload.expires_in),
  }
}

export async function refreshSendfoxToken(
  refreshToken: string,
  integrationId?: string | null,
  userId?: string | null,
) {
  if (!clientId || !clientSecret) {
    throw new Error("Missing SendFox OAuth configuration")
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  const payload = await requestToken(body)
  const expires_at = computeExpiresAt(payload.expires_in)
  if (integrationId && supabaseAdmin) {
    await supabaseAdmin
      .from("user_integrations")
      .update({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? refreshToken,
        expires_at,
      })
      .eq("id", integrationId)
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? refreshToken,
    expires_at,
    integrationId,
    userId,
  }
}

export async function upsertSendfoxIntegration(
  userId: string,
  payload: { access_token: string; refresh_token?: string | null; expires_at?: string | null },
) {
  if (!supabaseAdmin) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY")
  const { data, error } = await supabaseAdmin
    .from("user_integrations")
    .upsert(
      {
        user_id: userId,
        provider: "sendfox",
        access_token: payload.access_token,
        refresh_token: payload.refresh_token ?? null,
        expires_at: payload.expires_at ?? null,
      },
      { onConflict: "user_id,provider" },
    )
    .select()
    .maybeSingle()
  if (error || !data) {
    throw new Error(error?.message || "Failed to store SendFox tokens")
  }
  return data as SendfoxIntegration
}

export async function getSendfoxIntegration(userId: string) {
  if (!supabaseAdmin) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY")
  const { data, error } = await supabaseAdmin
    .from("user_integrations")
    .select("id,user_id,provider,access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .eq("provider", "sendfox")
    .maybeSingle()
  if (error) throw error
  return (data as SendfoxIntegration) || null
}

export async function ensureSendfoxContextFresh(context: SendfoxAuthContext) {
  if (!context.refreshToken) return context
  if (context.expiresAt) {
    const expiresMs = new Date(context.expiresAt).getTime()
    if (expiresMs - 60_000 > Date.now()) return context
  }
  const refreshed = await refreshSendfoxToken(
    context.refreshToken,
    context.integrationId,
    context.userId,
  )
  context.accessToken = refreshed.access_token
  context.refreshToken = refreshed.refresh_token
  context.expiresAt = refreshed.expires_at ?? undefined
  return context
}
