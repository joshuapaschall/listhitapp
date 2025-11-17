import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { updateEmailMetrics } from "@/services/email-metrics-service"

export async function POST(req: NextRequest) {
  try {
    let userId: string | undefined
    try {
      const body = await req.json()
      userId = body.userId
    } catch {}
    if (!userId) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id || undefined
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
      })
    }
    const result = await updateEmailMetrics(userId)
    return new Response(JSON.stringify(result))
  } catch (err: any) {
    console.error("Failed to update email metrics", err)
    return new Response(JSON.stringify({ error: err.message || "error" }), {
      status: 500,
    })
  }
}
