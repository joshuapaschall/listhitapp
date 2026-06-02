import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { createLogger } from "@/lib/logger"
import { countSegment, resolveSegment, validateDefinition } from "@/lib/segments/resolver"
import type { ResolveContext, SegmentDefinition } from "@/lib/segments/types"

const log = createLogger("api:segments:preview")

// Auth'd, per-request route — never prerender at build time.
export const dynamic = "force-dynamic"

const SAMPLE_SIZE = 5

export async function POST(request: Request) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })
    if (!(await hasPermission(supabase, "buyers.view"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const definition = body?.definition as SegmentDefinition | undefined
    const channel = body?.channel === "sms" ? "sms" : body?.channel === "email" ? "email" : null
    const contextCampaignId =
      typeof body?.contextCampaignId === "string" ? body.contextCampaignId : undefined

    if (!definition) return NextResponse.json({ error: "definition is required" }, { status: 400 })
    if (!channel) return NextResponse.json({ error: "channel must be 'email' or 'sms'" }, { status: 400 })

    // A malformed definition is a 400, never a 500.
    try {
      validateDefinition(definition)
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Invalid definition" }, { status: 400 })
    }

    const ctx: ResolveContext = {
      supabase,
      orgId,
      channel,
      contextCampaignId,
    }

    // Optionally fetch a small sample of names for display. Cheap: resolve once,
    // count from the set, then one buyers lookup for the first few ids.
    let count: number
    let sample: { id: string; name: string }[] | undefined

    if (body?.withSample) {
      const ids = await resolveSegment(definition, ctx)
      count = ids.size
      const sampleIds = Array.from(ids).slice(0, SAMPLE_SIZE)
      if (sampleIds.length) {
        const { data } = await supabase
          .from("buyers")
          .select("id, full_name, fname, lname, email")
          .eq("org_id", orgId)
          .in("id", sampleIds)
        sample = (data ?? []).map((b: any) => ({
          id: b.id,
          name:
            b.full_name ||
            [b.fname, b.lname].filter(Boolean).join(" ") ||
            b.email ||
            b.id,
        }))
      } else {
        sample = []
      }
    } else {
      count = await countSegment(definition, ctx)
    }

    return NextResponse.json({ count, sample })
  } catch (err: any) {
    log.error("preview failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
