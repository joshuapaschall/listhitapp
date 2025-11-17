import { NextRequest } from "next/server"
import { listThreads, getThread } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { syncGmailThreads } from "@/scripts/gmail-sync"
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const userId = user.id
  const maxParam = request.nextUrl.searchParams.get("maxResults")
  const max = maxParam ? parseInt(maxParam, 10) : 20
  const folder = request.nextUrl.searchParams.get("folder") || "inbox"

  try {
    await syncGmailThreads(userId, max, folder)

    let { data } = await supabaseAdmin
      .from("gmail_threads")
      .select(
        "id, starred, unread, email_threads(thread_id,buyer_id,subject,snippet,buyers(full_name))",
      )
      .order("updated_at", { ascending: false })
      .limit(max)

    if (!data || data.length === 0) {
      const basic = await listThreads(userId, max, folder)
      const threads = await Promise.all(
        basic.map(async (t) => {
          const full = await getThread(userId, t.id)
          return {
            ...full,
            starred: t.starred ?? full.starred,
            unread: t.unread ?? full.unread,
          }
        }),
      )
      return new Response(JSON.stringify({ threads }))
    }

    const threads = await Promise.all(
      data.map(async (r) => {
        const thread = await getThread(userId, r.id)
        return {
          ...thread,
          starred: r.starred ?? thread.starred,
          unread: r.unread ?? thread.unread,
          email_threads: r.email_threads || [],
        }
      }),
    )

    return new Response(JSON.stringify({ threads }))
  } catch (err: any) {
    console.error("Failed to list threads", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
