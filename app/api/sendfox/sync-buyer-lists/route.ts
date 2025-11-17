import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  try {
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

    const base = process.env.DISPOTOOL_BASE_URL || ""
    const resp = await fetch(`${base}/api/sendfox/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: buyer.email, lists: listIds }),
      cache: "no-store",
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      console.error("sync-buyer-lists: sendfox error", {
        buyerId,
        listIds,
        data,
        status: resp.status,
      })
      return new Response(
        JSON.stringify({ error: "sendfox sync failed", data }),
        { status: 502 },
      )
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
