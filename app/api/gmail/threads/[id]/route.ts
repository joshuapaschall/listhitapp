import { NextRequest } from "next/server"
import { getThread } from "@/services/gmail-api"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }
  const userId = user.id
  try {
    const thread = await getThread(userId, params.id)
    return new Response(JSON.stringify({ thread }))
  } catch (err: any) {
    console.error("Failed to get thread", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), { status: 500 })
  }
}
