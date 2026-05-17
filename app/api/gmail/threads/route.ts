import { NextRequest } from "next/server"
import { listThreads, getThread, listDrafts } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

  const userId = user.id
  const maxParam = request.nextUrl.searchParams.get("maxResults")
  const max = maxParam ? parseInt(maxParam, 10) : 50
  const pageToken = request.nextUrl.searchParams.get("pageToken") || undefined
  const labelId = request.nextUrl.searchParams.get("labelId")
  const folder = request.nextUrl.searchParams.get("folder") || "inbox"

  const target = labelId || folder
  const includeSpamTrash =
    target === "TRASH" || target === "SPAM" ||
    target === "trash" || target === "spam"

  try {
    const { threads: basic, nextPageToken, resultSizeEstimate } =
      await listThreads(userId, max, target, { includeSpamTrash, pageToken })

    const threads = await Promise.all(basic.map(async (t) => {
      const full = await getThread(userId, t.id || "")
      return {
        ...full,
        starred: t.starred ?? full.starred,
        unread: t.unread ?? full.unread,
      }
    }))

    const isDrafts = target === "drafts" || target === "DRAFT"
    let threadsWithDrafts = threads
    if (isDrafts) {
      const draftIndex = await listDrafts(userId)
      const threadIdToDraftId = new Map<string, string>()
      for (const d of draftIndex) {
        if (d.threadId) threadIdToDraftId.set(d.threadId, d.id)
      }
      threadsWithDrafts = threads.map((t: any) => ({
        ...t,
        draftId: t.id ? threadIdToDraftId.get(t.id) || null : null,
      }))
    }

    return new Response(JSON.stringify({
      threads: threadsWithDrafts,
      nextPageToken,
      resultSizeEstimate,
    }))
  } catch (err) {
    console.error("Failed to list threads", err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "error" }),
      { status: 500 },
    )
  }
}
