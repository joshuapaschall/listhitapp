import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:segments:options")

// Auth'd, per-request route — never prerender at build time.
export const dynamic = "force-dynamic"

const OPTION_LIMIT = 500
// Rows scanned when deriving distinct values from buyer columns.
const SCAN_LIMIT = 5000

type Option = { value: string; label: string }

function dedupeStrings(values: Array<string | null | undefined>): Option[] {
  const seen = new Set<string>()
  const out: Option[] = []
  for (const raw of values) {
    const v = (raw ?? "").toString().trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push({ value: v, label: v })
    if (out.length >= OPTION_LIMIT) break
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

export async function GET(request: Request) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const field = new URL(request.url).searchParams.get("field") || ""

    if (field === "tags") {
      const { data, error } = await supabase
        .from("tags")
        .select("name")
        .order("name", { ascending: true })
        .limit(OPTION_LIMIT)
      if (error) throw error
      return NextResponse.json({ options: dedupeStrings((data ?? []).map((r: any) => r.name)) })
    }

    if (field === "campaigns") {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, channel, scheduled_at, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(OPTION_LIMIT)
      if (error) throw error
      const options = (data ?? []).map((c: any) => ({
        value: c.id,
        label: c.name || "(untitled campaign)",
        channel: c.channel ?? null,
        sentAt: c.scheduled_at || c.created_at || null,
      }))
      return NextResponse.json({ options })
    }

    // Scalar buyer columns → distinct values.
    if (field === "status" || field === "source") {
      const { data, error } = await supabase
        .from("buyers")
        .select(field)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .not(field, "is", null)
        .limit(SCAN_LIMIT)
      if (error) throw error
      return NextResponse.json({ options: dedupeStrings((data ?? []).map((r: any) => r[field])) })
    }

    // text[] buyer columns → unnest + distinct in JS.
    if (field === "locations" || field === "property_type") {
      const { data, error } = await supabase
        .from("buyers")
        .select(field)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .not(field, "is", null)
        .limit(SCAN_LIMIT)
      if (error) throw error
      const flat: string[] = []
      for (const row of data ?? []) {
        const arr = (row as any)[field]
        if (Array.isArray(arr)) flat.push(...arr)
      }
      return NextResponse.json({ options: dedupeStrings(flat) })
    }

    return NextResponse.json({ error: `Unknown field "${field}"` }, { status: 400 })
  } catch (err: any) {
    log.error("options failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
