import { apiError } from "@/lib/api-error"
import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"

type Row = {
  id: string
  email: string | null
  can_receive_email: boolean | null
  deleted_at: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    if (!orgId) return new Response(JSON.stringify({ error: "Missing org" }), { status: 400 })

    const body = await req.json()
    const groupIds: string[] = Array.isArray(body?.groupIds) ? body.groupIds : []
    if (!groupIds.length) {
      return new Response(JSON.stringify({ count: 0, sample: [], reason: "no groups" }), { status: 200 })
    }

    const { data: buyers, error } = await supabase
      .from("buyers")
      .select("id,email,can_receive_email,deleted_at,buyer_groups!inner(group_id)")
      .eq("org_id", orgId) // scope to caller's org — belt & braces alongside RLS
      .in("buyer_groups.group_id", groupIds as any)
    if (error) return apiError(error, 500)

    const recipients = (buyers as any as Row[])
      .filter(b => !b.deleted_at)
      .filter(b => !!b.email)
      .filter(b => (b.can_receive_email !== false)) // switch to === true if you want strict consent

    const unique: Row[] = []
    const seen = new Set<string>()
    for (const r of recipients) {
      const key = (r.email || "").toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      unique.push(r)
    }

    const sample = unique.slice(0, 10).map(r => r.email)

    return new Response(JSON.stringify({ count: unique.length, sample }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500 })
  }
}
