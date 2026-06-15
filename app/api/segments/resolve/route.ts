import { apiError } from "@/lib/api-error"
import { NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { createLogger } from "@/lib/logger"
import { SegmentContextError, resolveSegment, validateDefinition } from "@/lib/segments/resolver"
import type { ResolveContext, SegmentDefinition } from "@/lib/segments/types"

const log = createLogger("api:segments:resolve")

// Auth'd, per-request route — never prerender at build time.
export const dynamic = "force-dynamic"

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

    // Malformed definition is a 400, never a 500.
    try {
      validateDefinition(definition)
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Invalid definition" }, { status: 400 })
    }

    const ctx: ResolveContext = { supabase, orgId, channel, contextCampaignId }
    const ids = await resolveSegment(definition, ctx)
    const buyerIds = Array.from(ids)
    return NextResponse.json({ buyerIds, count: buyerIds.length })
  } catch (err: any) {
    if (err instanceof SegmentContextError) {
      // This is deliberate, user-facing guidance (e.g. "can only be previewed
      // inside a campaign"), not a leaky internal error — surface its message.
      return apiError(err, 400, err.message)
    }
    log.error("resolve failed", err)
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
