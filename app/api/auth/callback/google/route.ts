import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const search = request.nextUrl.searchParams
  const code = search.get("code")
  const state = search.get("state")
  const error = search.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/gmail?connect_error=${encodeURIComponent(error)}`, request.url))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/gmail?connect_error=missing_params", request.url))
  }

  const stateCookie = request.cookies.get("gmail_oauth_state")?.value
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(new URL("/gmail?connect_error=state_mismatch", request.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/gmail?connect_error=env_missing", request.url))
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error("OAuth token exchange failed:", tokenRes.status, body)
    return NextResponse.redirect(new URL("/gmail?connect_error=token_exchange_failed", request.url))
  }

  const tokenJson = await tokenRes.json()
  const accessToken: string = tokenJson.access_token
  const refreshToken: string | undefined = tokenJson.refresh_token
  const expiresIn: number = tokenJson.expires_in || 0
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + expiresIn

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/gmail?connect_error=userinfo_failed", request.url))
  }
  const profile = await profileRes.json()
  const email: string = profile.email
  if (!email) {
    return NextResponse.redirect(new URL("/gmail?connect_error=no_email", request.url))
  }

  const { data: existing } = await supabaseAdmin
    .from("gmail_tokens")
    .select("id, refresh_token, is_active")
    .eq("user_id", user.id)
    .eq("email", email)
    .maybeSingle()

  const finalRefreshToken = refreshToken || existing?.refresh_token
  if (!finalRefreshToken) {
    return NextResponse.redirect(new URL("/gmail?connect_error=no_refresh_token", request.url))
  }

  const { count: existingCount } = await supabaseAdmin
    .from("gmail_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  const shouldBeActive = (existingCount || 0) === 0 || !!existing?.is_active

  if (existing) {
    await supabaseAdmin
      .from("gmail_tokens")
      .update({
        access_token: accessToken,
        refresh_token: finalRefreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
  } else {
    await supabaseAdmin.from("gmail_tokens").insert({
      user_id: user.id,
      email,
      access_token: accessToken,
      refresh_token: finalRefreshToken,
      expires_at: expiresAt,
      is_active: shouldBeActive,
    })
  }

  const response = NextResponse.redirect(new URL("/gmail?connected=1", request.url))
  response.cookies.delete("gmail_oauth_state")
  return response
}
