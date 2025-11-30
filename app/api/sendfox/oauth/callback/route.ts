import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import {
  exchangeAuthorizationCode,
  saveSendFoxTokens,
} from "@/services/sendfox-auth-service"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = cookies()
  const storedState = cookieStore.get("sendfox_oauth_state")?.value
  cookieStore.delete("sendfox_oauth_state")

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect("/settings/sendfox?error=oauth_state")
  }

  const cookieClient = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { session },
  } = await cookieClient.auth.getSession()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.redirect("/login")
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin
  const redirectUri = `${origin}/api/sendfox/oauth/callback`
  try {
    const tokens = await exchangeAuthorizationCode(code, redirectUri)
    await saveSendFoxTokens(userId, tokens)
    return NextResponse.redirect("/settings/sendfox?connected=1")
  } catch (err) {
    console.error("SendFox OAuth callback failed", err)
    return NextResponse.redirect("/settings/sendfox?error=oauth_failed")
  }
}
