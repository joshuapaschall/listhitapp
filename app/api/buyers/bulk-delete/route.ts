import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return new Response(JSON.stringify({ error: "ids required" }), { status: 400 })

    // mark hidden + deleted_at, remove group links
    await supabase.from("buyer_groups").delete().in("buyer_id", ids)
    await supabase
      .from("buyers")
      .update({ sendfox_hidden: true, deleted_at: new Date().toISOString() })
      .in("id", ids)

    // move each to Deleted list in SendFox
    const deletedList = Number(process.env.SENDFOX_DELETED_LIST_ID)
    const base = process.env.DISPOTOOL_BASE_URL || ""
    for (const id of ids) {
      const { data: buyer } = await supabase
        .from("buyers")
        .select("email,fname")
        .eq("id", id)
        .single()
      if (!buyer?.email) continue
      console.log("delete: moving contact to Deleted list only", {
        email: buyer.email,
        listId: deletedList,
      })
      await fetch(`${base}/api/sendfox/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: buyer.email,
          first_name: buyer.fname || "Deleted",
          lists: [deletedList],
        }),
      })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
