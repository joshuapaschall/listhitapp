import { NextRequest } from "next/server"
import { setThreadStarred } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST(request: NextRequest) {
  const { threadId, starred } = await request.json()
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const userId = user.id
  if (!threadId || typeof starred !== "boolean") {
    return new Response(
      JSON.stringify({ error: "threadId and starred required" }),
      { status: 400 },
    )
  }
  try {
    await setThreadStarred(userId, threadId, starred)
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    console.error("Failed to update star", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
