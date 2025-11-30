import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { exchangeSendfoxCode, upsertSendfoxIntegration } from "@/services/sendfox-auth"

export async function GET(req: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const storedState = cookieStore.get("sendfox_oauth_state")?.value

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code" }), { status: 400 })
  }
  if (storedState && state !== storedState) {
    return new Response(JSON.stringify({ error: "Invalid state" }), { status: 400 })
  }

  try {
    const token = await exchangeSendfoxCode(code)
    await upsertSendfoxIntegration(user.id, token)
    const res = NextResponse.redirect(new URL("/integrations", url.origin))
    res.cookies.delete("sendfox_oauth_state")
    return res
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "error" }), { status: 500 })
  }
}
