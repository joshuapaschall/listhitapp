import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

const clientId = process.env.GOOGLE_CLIENT_ID as string
const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string

export async function getAccessToken(
  userId: string,
  email?: string,
): Promise<string> {
  const column = email ? "email" : "user_id"
  const value = email || userId
  const { data, error } = await supabaseAdmin
    .from("gmail_tokens")
    .select("access_token, refresh_token, expires_at, user_id")
    .eq(column, value)
    .maybeSingle()
  if (error || !data) {
    throw new Error("Gmail token not found")
  }
  let { access_token, refresh_token, expires_at } = data as any
  const now = Math.floor(Date.now() / 1000)
  if (!access_token || !expires_at || expires_at < now) {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      grant_type: "refresh_token",
    })
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    })
    if (!res.ok) {
      throw new Error("Failed to refresh Gmail token")
    }
    const body = await res.json()
    access_token = body.access_token
    expires_at = now + Number(body.expires_in || 0)
    await supabaseAdmin
      .from("gmail_tokens")
      .update({ access_token, expires_at })
      .eq("user_id", data.user_id)
  }
  return access_token
}
