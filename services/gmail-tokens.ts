import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const clientId = process.env.GOOGLE_CLIENT_ID as string
const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string

interface TokenRow {
  id: string
  user_id: string
  email: string | null
  access_token: string | null
  refresh_token: string
  expires_at: number | null
}

/**
 * Returns a fresh access token for the given user.
 * - If `email` is provided, looks up that specific account.
 * - Otherwise, looks up the user's currently active account.
 * Throws "Gmail token not found" if none exists.
 */
export async function getAccessToken(userId: string, email?: string): Promise<string> {
  const row = await loadTokenRow(userId, email)
  if (!row) throw new Error("Gmail token not found")
  return await ensureFreshAccessToken(row)
}

/**
 * Same as getAccessToken but returns the full row (id, email, etc) so callers
 * can know which account was used. Useful for routes that need both the token
 * and the account context.
 */
export async function getActiveAccount(userId: string): Promise<{
  id: string
  email: string | null
  accessToken: string
}> {
  const row = await loadTokenRow(userId)
  if (!row) throw new Error("Gmail token not found")
  const accessToken = await ensureFreshAccessToken(row)
  return { id: row.id, email: row.email, accessToken }
}

async function loadTokenRow(userId: string, email?: string): Promise<TokenRow | null> {
  let query = supabaseAdmin
    .from("gmail_tokens")
    .select("id, user_id, email, access_token, refresh_token, expires_at")
    .eq("user_id", userId)

  if (email) {
    query = query.eq("email", email)
  } else {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("Failed to load Gmail token row:", error)
    return null
  }

  return (data as TokenRow) || null
}

async function ensureFreshAccessToken(row: TokenRow): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (row.access_token && row.expires_at && row.expires_at > now + 30) {
    return row.access_token
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error("Gmail token refresh failed:", res.status, body)
    throw new Error("Failed to refresh Gmail token")
  }
  const body = await res.json()
  const accessToken = body.access_token as string
  const expiresAt = now + Number(body.expires_in || 0)

  await supabaseAdmin
    .from("gmail_tokens")
    .update({ access_token: accessToken, expires_at: expiresAt })
    .eq("id", row.id)

  return accessToken
}
