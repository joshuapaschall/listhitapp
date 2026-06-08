import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { blockBuyer, unblockBuyer } from "@/lib/buyers/block"

// Dedicated block/unblock endpoint — intentionally NOT routed through the generic
// buyer PATCH, so block state can't be mass-assigned and so it runs the
// bidirectional suppression logic.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "buyers.edit")
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const action = body?.action as "block" | "unblock" | undefined
  const reason = typeof body?.reason === "string" ? body.reason : undefined

  if (action !== "block" && action !== "unblock") {
    return NextResponse.json({ error: "action must be 'block' or 'unblock'" }, { status: 400 })
  }

  const { error } =
    action === "block" ? await blockBuyer(params.id, reason) : await unblockBuyer(params.id)

  if (error) {
    return apiError(error, 500)
  }

  return NextResponse.json({ ok: true, blocked_at: action === "block" ? new Date().toISOString() : null })
}
