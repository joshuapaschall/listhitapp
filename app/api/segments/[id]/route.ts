import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { createLogger } from "@/lib/logger"
import { validateDefinition } from "@/lib/segments/resolver"
import type { SegmentDefinition } from "@/lib/segments/types"

const log = createLogger("api:segments:id")

// Auth'd, per-request route — never prerender at build time.
export const dynamic = "force-dynamic"

function normalizeChannel(value: unknown): "email" | "sms" | null {
  return value === "email" || value === "sms" ? value : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
      .eq("id", params.id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    return NextResponse.json({ segment: data })
  } catch (err: any) {
    log.error("GET failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }

    if (typeof body?.name === "string") {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
      patch.name = name
    }
    if (body?.description !== undefined) {
      patch.description = typeof body.description === "string" ? body.description : null
    }
    if (body?.channel !== undefined) {
      patch.channel = normalizeChannel(body.channel)
    }
    if (body?.definition !== undefined) {
      const definition: SegmentDefinition = body.definition
      try {
        validateDefinition(definition)
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || "Invalid definition" }, { status: 400 })
      }
      patch.definition = definition
      // Keep the match column mirrored to the jsonb.
      patch.match = definition.match
    }

    // org_id is never accepted from the client; the row is already org-scoped.
    const { data, error } = await supabase
      .from("segments")
      .update(patch)
      .eq("id", params.id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .select("*")
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: "Segment not found" }, { status: 404 })
    return NextResponse.json({ segment: data })
  } catch (err: any) {
    log.error("PATCH failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Soft delete only — campaigns may reference this segment via segment_id.
    const { error } = await supabase
      .from("segments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("org_id", orgId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    log.error("DELETE failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
