import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const { buyerIds, targetGroupIds, keepDefault } = await req.json()
    if (!Array.isArray(buyerIds) || !Array.isArray(targetGroupIds)) {
      return NextResponse.json(
        { error: "buyerIds and targetGroupIds required" },
        { status: 400 },
      )
    }

    const { data: rpcResult, error } = await supabase.rpc("replace_groups_for_buyers", {
      buyer_ids: buyerIds,
      target_group_ids: targetGroupIds,
      keep_default: !!keepDefault,
    })
    if (error) {
      console.error("replace-groups: rpc error", { error })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const changedRows = Number((rpcResult as any)?.changed_rows ?? 0)

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
