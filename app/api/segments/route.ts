import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { createLogger } from "@/lib/logger"
import { validateDefinition } from "@/lib/segments/resolver"
import type { SegmentDefinition } from "@/lib/segments/types"

const log = createLogger("api:segments")

// Auth'd, per-request route — never prerender at build time.
export const dynamic = "force-dynamic"

const EMPTY_DEFINITION: SegmentDefinition = { match: "all", conditions: [] }

function normalizeChannel(value: unknown): "email" | "sms" | null {
  return value === "email" || value === "sms" ? value : null
}

export async function GET() {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("segments")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })

    if (error) throw error
    return NextResponse.json({ segments: data ?? [] })
  } catch (err: any) {
    log.error("GET failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const definition: SegmentDefinition = body?.definition ?? EMPTY_DEFINITION
    try {
      validateDefinition(definition)
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Invalid definition" }, { status: 400 })
    }

    // Strip any client-supplied org_id; always use the server-resolved org.
    const { data, error } = await supabase
      .from("segments")
      .insert({
        org_id: orgId,
        created_by: user.id,
        name,
        description: typeof body?.description === "string" ? body.description : null,
        channel: normalizeChannel(body?.channel),
        match: definition.match,
        definition,
      })
      .select("*")
      .single()

    if (error) throw error
    return NextResponse.json({ segment: data }, { status: 201 })
  } catch (err: any) {
    log.error("POST failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
