import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { withSendfoxAuth } from "@/services/sendfox-auth"
import { loadSendfoxRouteContext } from "../_auth"
import { upsertContact } from "@/services/sendfox-service"

export async function POST(req: NextRequest) {
  try {
    const { authContext, response } = await loadSendfoxRouteContext()
    if (response) return response
    if (!authContext) {
      return new Response(JSON.stringify({ connected: false, error: "SendFox not connected" }), {
        status: 200,
      })
    }

    const { buyerId } = await req.json()
    if (!buyerId) {
      return new Response(JSON.stringify({ error: "buyerId required" }), { status: 400 })
    }

    const { data: buyer, error: be } = await supabase
      .from("buyers")
      .select("email, sendfox_hidden")
      .eq("id", buyerId)
      .single()
    if (be || !buyer?.email) {
      return new Response(JSON.stringify({ error: "buyer not found" }), { status: 404 })
    }
    if (buyer.sendfox_hidden) {
      return new Response(JSON.stringify({ ignored: true, reason: "hidden" }), { status: 200 })
    }

    const { data: rows, error: rowsErr } = await supabase
      .from("buyer_groups")
      .select("groups(sendfox_list_id)")
      .eq("buyer_id", buyerId)
    if (rowsErr) {
      return new Response(JSON.stringify({ error: rowsErr.message }), { status: 500 })
    }

    const listIds = Array.from(
      new Set(
        (rows || [])
          .map((r: any) => Number(r?.groups?.sendfox_list_id))
          .filter((n: any) => Number.isInteger(n)),
      ),
    )

    console.log("sync-buyer-lists: computed listIds", { buyerId, listIds })

    await withSendfoxAuth(authContext, async () =>
      upsertContact(buyer.email, undefined, undefined, listIds),
    )

    return new Response(JSON.stringify({ ok: true, connected: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
