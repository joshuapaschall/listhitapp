import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"

export const runtime = "nodejs"

function normE164(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
  return /^\+\d{11,15}$/.test(e164) ? e164 : null
}

export async function POST(req: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  // Admin bearer gate
  const authz = req.headers.get("authorization") || ""
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : ""
  if (!token || token !== process.env.ADMIN_TASKS_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const rows = Array.isArray(body?.rows) ? body.rows : []
  if (!rows.length) return NextResponse.json({ error: "rows_required" }, { status: 400 })

  const upserts: { e164: string; org_id: string; label?: string | null }[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const e164 = normE164(r?.e164)
    if (!e164 || seen.has(e164)) continue
    seen.add(e164)
    upserts.push({ e164, org_id: orgId, label: r?.label ?? null })
  }
  if (!upserts.length) return NextResponse.json({ error: "no_valid_numbers" }, { status: 400 })

  const { data, error } = await supabase
    .from("inbound_numbers")
    .upsert(upserts, { onConflict: "e164" })
    .select("e164, org_id, label, enabled")

  if (error) {
    console.error("inbound_numbers upsert error:", error)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  return NextResponse.json({ count: data?.length ?? 0, items: data })
}
