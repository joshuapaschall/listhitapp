import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { revokeSendFoxToken } from "@/services/sendfox-auth-service"

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ connected: false }, { status: 401 })

  const { data } = await supabase
    .from("sendfox_tokens")
    .select("expires_at,revoked_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (!data || data.revoked_at) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    expires_at: data.expires_at,
    updated_at: data.updated_at,
  })
}

export async function DELETE() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  await revokeSendFoxToken(userId)
  return NextResponse.json({ revoked: true })
}
