import { NextRequest } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"

export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return json({ error: "Unauthorized" }, 401)

    const { data: existing, error: fetchErr } = await supabase
      .from("negative_keywords")
      .select("is_system")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!existing) return json({ error: "Keyword not found" }, 404)
    if (existing.is_system) return json({ error: "System keywords can't be edited." }, 403)

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (typeof body?.keyword === "string") {
      const k = body.keyword.trim()
      if (!k) return json({ error: "Keyword is required" }, 400)
      updates.keyword = k
    }
    if (body?.matchType) updates.match_type = body.matchType === "exact" ? "exact" : "phrase"
    if (body?.action) updates.action = body.action === "dnc" ? "dnc" : "hide"

    const { data, error } = await supabase
      .from("negative_keywords")
      .update(updates)
      .eq("id", id)
      .eq("org_id", orgId)
      .select()
      .single()

    if (error) {
      if ((error as any).code === "23505") {
        return json({ error: "That keyword already exists with that match type." }, 400)
      }
      throw error
    }

    return json(data)
  } catch (err: any) {
    console.error("[negative-keywords] PATCH error", { id, err })
    return json({ error: err?.message || "error" }, 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return json({ error: "Unauthorized" }, 401)

    const { data: existing, error: fetchErr } = await supabase
      .from("negative_keywords")
      .select("is_system")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!existing) return json({ error: "Keyword not found" }, 404)
    if (existing.is_system) return json({ error: "System keywords can't be deleted." }, 403)

    const { error } = await supabase
      .from("negative_keywords")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId)
    if (error) throw error

    return json({ success: true })
  } catch (err: any) {
    console.error("[negative-keywords] DELETE error", { id, err })
    return json({ error: err?.message || "error" }, 500)
  }
}
