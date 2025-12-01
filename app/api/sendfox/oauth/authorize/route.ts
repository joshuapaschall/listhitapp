import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { randomUUID } from "crypto"
import { getSendfoxAuthorizationUrl } from "@/services/sendfox-auth"

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const state = randomUUID()
    const url = getSendfoxAuthorizationUrl(state)
    const res = NextResponse.json({ url })
    res.cookies.set("sendfox_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })
    return res
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 })
  }
}
