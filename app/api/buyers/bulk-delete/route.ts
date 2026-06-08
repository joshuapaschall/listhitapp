import { apiError } from "@/lib/api-error"
import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(req: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
  if (!orgId) return new Response(JSON.stringify({ error: "no org context" }), { status: 400 })

  const denied = await requirePermission(supabase, "buyers.delete")
  if (denied) return denied

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return new Response(JSON.stringify({ error: "ids required" }), { status: 400 })
  }

  // Remove group links scoped to this org.
  await supabase.from("buyer_groups").delete().eq("org_id", orgId).in("buyer_id", ids)

  // Soft-delete buyers scoped to this org; capture the rows actually affected.
  const { data, error } = await supabase
    .from("buyers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .in("id", ids)
    .is("deleted_at", null)
    .select("id")

  if (error) return apiError(error, 500)

  return new Response(JSON.stringify({ ok: true, deleted: data?.length ?? 0 }), { status: 200 })
}
