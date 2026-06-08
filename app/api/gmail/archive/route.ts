import { apiError } from "@/lib/api-error"
import { NextRequest } from "next/server"
import { archiveThread } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(request: NextRequest) {
  const { threadId } = await request.json()
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const denied = await requirePermission(supabase, "gmail.access")
  if (denied) return denied
  const userId = user.id
  if (!threadId) {
    return new Response(JSON.stringify({ error: "threadId required" }), { status: 400 })
  }
  try {
    await archiveThread(userId, threadId)
    return new Response(JSON.stringify({ success: true }))
  } catch (err: any) {
    console.error("Failed to archive thread", err)
    return apiError(err, 500)
  }
}
