import { NextRequest, NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  try {
    const { buyerIds, targetGroupIds, keepDefault } = await req.json()
    if (!Array.isArray(buyerIds) || !Array.isArray(targetGroupIds)) {
      return NextResponse.json(
        { error: "buyerIds and targetGroupIds required" },
        { status: 400 },
      )
    }

    const db = supabaseAdmin ?? supabase
    const { data: rpcResult, error } = await db.rpc("replace_groups_for_buyers", {
      buyer_ids: buyerIds,
      target_group_ids: targetGroupIds,
      keep_default: !!keepDefault,
    })
    if (error) {
      console.error("replace-groups: rpc error", { error })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const changedRows = Number((rpcResult as any)?.changed_rows ?? 0)

    const base = process.env.DISPOTOOL_BASE_URL || ""
    for (const buyerId of buyerIds) {
      const syncRes = await fetch(`${base}/api/sendfox/sync-buyer-lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId }),
      })
      if (!syncRes.ok) {
        const body = await syncRes.json().catch(() => ({}))
        console.error("replace-groups: sync-buyer-lists failed", {
          buyerId,
          targetGroupIds,
          body,
        })
        return NextResponse.json(
          { error: "sendfox sync failed", body },
          { status: 502 },
        )
      }
    }

    const toPlainJson = (obj: unknown) =>
      JSON.parse(
        JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v)),
      )

    return NextResponse.json(toPlainJson({ ok: true, changedRows }))
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "error" },
      { status: 500 },
    )
  }
}
