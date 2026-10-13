import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"

type Provider = "telnyx" | "twilio"

function normE164(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`
  return /^\+\d{11,15}$/.test(e164) ? e164 : null
}

// Platform-admin seed of the caller's org numbers. Insert-only: a number already
// owned by ANOTHER org rejects the whole request, and nothing is ever reassigned.
export async function POST(req: Request) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })
  if (!isPlatformAdmin(user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 })

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

  const inserts: { e164: string; org_id: string; label: string | null; provider: Provider }[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const provider = r?.provider
    if (provider !== "telnyx" && provider !== "twilio") {
      return NextResponse.json({ error: "provider_required" }, { status: 400 })
    }
    const e164 = normE164(r?.e164)
    if (!e164 || seen.has(e164)) continue
    seen.add(e164)
    inserts.push({ e164, org_id: orgId, label: r?.label ?? null, provider })
  }
  if (!inserts.length) return NextResponse.json({ error: "no_valid_numbers" }, { status: 400 })

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("inbound_numbers")
    .select("e164, org_id")
    .in("e164", inserts.map((i) => i.e164))
  if (lookupError) {
    console.error("inbound_numbers lookup error:", lookupError)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  const owned = (existing || []) as { e164: string; org_id: string }[]
  if (owned.some((row) => row.org_id !== orgId)) {
    return NextResponse.json({ error: "number_owned_by_another_org" }, { status: 409 })
  }

  const already = new Set(owned.map((row) => row.e164))
  const fresh = inserts.filter((i) => !already.has(i.e164))
  if (!fresh.length) return NextResponse.json({ count: 0, items: [], skipped: [...already] })

  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .insert(fresh)
    .select("e164, org_id, label, enabled, provider")

  if (error) {
    console.error("inbound_numbers insert error:", error)
    return NextResponse.json({ error: "db_error" }, { status: 500 })
  }

  return NextResponse.json({ count: data?.length ?? 0, items: data, skipped: [...already] })
}
