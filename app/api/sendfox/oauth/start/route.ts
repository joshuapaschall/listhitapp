import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { buildAuthorizeUrl } from "@/services/sendfox-auth-service"

export async function GET(request: Request) {
  const state = crypto.randomUUID()
  const cookieStore = cookies()
  cookieStore.set("sendfox_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const redirectUri = `${origin}/api/sendfox/oauth/callback`
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri)
  return NextResponse.redirect(authorizeUrl)
}
