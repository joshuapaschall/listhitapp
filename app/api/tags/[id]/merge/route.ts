import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"
import { tagRpcErrorResponse } from "@/lib/tags/rpc-errors"

export const dynamic = "force-dynamic"

type RouteParams = { params: { id: string } }

export async function POST(request: Request, { params }: RouteParams) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const denied = await requirePermission(supabase, "settings.tags")
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { targetId?: unknown }
  const targetId = typeof body.targetId === "string" ? body.targetId : ""
  if (!targetId) {
    return NextResponse.json({ error: "Pick a tag to merge into." }, { status: 400 })
  }

  const { error } = await supabaseAdmin.rpc("tag_merge", {
    p_org_id: orgId,
    p_source_id: params.id,
    p_target_id: targetId,
  })
  if (error) {
    return tagRpcErrorResponse(error, { orgId, sourceId: params.id, targetId, action: "merge" })
  }

  return NextResponse.json({ ok: true })
}
