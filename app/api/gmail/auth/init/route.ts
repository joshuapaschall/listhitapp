import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { randomBytes } from "crypto"
import { assertServer } from "@/utils/assert-server"
import { requirePermission } from "@/lib/permissions/server"

assertServer()

const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ")

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Gmail OAuth env vars missing" }, { status: 500 })
  }

  const state = randomBytes(24).toString("hex")
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })

  // Optional: pre-select a specific Google account when reconnecting.
  const loginHint = request.nextUrl.searchParams.get("login_hint")
  if (loginHint) params.set("login_hint", loginHint)

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  const response = NextResponse.redirect(authUrl)
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  })
  return response
}
