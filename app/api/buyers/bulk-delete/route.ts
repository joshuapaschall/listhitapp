import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabase } from "@/lib/supabase"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const routeSupabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const denied = await requirePermission(routeSupabase, "buyers.delete")
  if (denied) return denied

  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return new Response(JSON.stringify({ error: "ids required" }), { status: 400 })

    // mark deleted_at and remove group links
    await supabase.from("buyer_groups").delete().in("buyer_id", ids)
    await supabase
      .from("buyers")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
