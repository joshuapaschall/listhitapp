import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { requirePermission } from "@/lib/permissions/server"
import { reconcileSendfoxLists } from "@/services/sendfox-service"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const listId = body?.listId ? Number(body.listId) : undefined
    const dryRun = body?.dryRun !== false

    const authHeader = req.headers.get("authorization")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!(authHeader && serviceKey && authHeader === `Bearer ${serviceKey}`)) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      const denied = await requirePermission(supabase, "settings.integrations")
      if (denied) return denied
    }

    const result = await reconcileSendfoxLists({ listId, dryRun })
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (err: any) {
    console.error("SendFox reconcile failed", err)
    return new Response(JSON.stringify({ error: err?.message || "error" }), {
      status: 500,
    })
  }
}
