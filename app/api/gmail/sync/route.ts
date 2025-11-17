import { NextRequest } from "next/server"
import { syncGmailThreads } from "@/scripts/gmail-sync"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function GET() {
  return new Response(
    JSON.stringify({ message: "Use POST to sync Gmail threads" }),
    { status: 405, headers: { Allow: "POST" } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const { maxResults, folder } = await request.json().catch(() => ({}))
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }
    const count = await syncGmailThreads(user.id, maxResults || 100, folder || "inbox")
    return new Response(JSON.stringify({ synced: count }))
  } catch (err: any) {
    console.error("Failed to sync Gmail threads", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
