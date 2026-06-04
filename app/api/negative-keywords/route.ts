import { NextRequest } from "next/server"
import { getOrgScopedClient } from "@/lib/auth/scoped-db"

export const dynamic = "force-dynamic"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export async function GET() {
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return json({ error: "Unauthorized" }, 401)

    const { data, error } = await supabase
      .from("negative_keywords")
      .select("*")
      .eq("org_id", orgId)
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: true })
    if (error) throw error

    return json(data ?? [])
  } catch (err: any) {
    console.error("[negative-keywords] GET error", err)
    return json({ error: err?.message || "error" }, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getOrgScopedClient()
    if (!user || !orgId) return json({ error: "Unauthorized" }, 401)

    const body = await req.json().catch(() => ({}))
    const keyword = String(body?.keyword ?? "").trim()
    if (!keyword) return json({ error: "Keyword is required" }, 400)

    const matchType = body?.matchType === "exact" ? "exact" : "phrase"
    const action = body?.action === "dnc" ? "dnc" : "hide"

    const { data, error } = await supabase
      .from("negative_keywords")
      .insert({ keyword, match_type: matchType, action, org_id: orgId, is_system: false })
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
    console.error("[negative-keywords] POST error", err)
    return json({ error: err?.message || "error" }, 500)
  }
}
