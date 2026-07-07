import { apiError } from "@/lib/api-error"
import { NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"
import { hasPermission } from "@/lib/permissions/server"
import { requireOrgContext } from "@/lib/auth/org-context"

const log = createLogger("api:campaigns:patch")

async function hasAnyCampaignSendPermission(supabase: any) {
  return (
    (await hasPermission(supabase, "campaigns.send_sms")) ||
    (await hasPermission(supabase, "campaigns.send_email"))
  )
}

const allowed = new Set([
  "name", "subject", "message", "group_ids", "buyer_ids", "scheduled_at", "timezone", "run_from", "run_until", "weekday_only", "media_url", "send_to_all_numbers", "from_name", "from_email", "preview_text", "status", "design_json", "mjml", "property_id", "shorten_links",
  // Segment provenance (Phase 3b): resolved buyer_ids stay the send source; these
  // record which segment/definition produced them for Phase 3c re-resolution.
  "segment_id",
  "audience_definition",
  "audience_preview_count",
])

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id,status,user_id,org_id")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .maybeSingle()

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (!(await hasAnyCampaignSendPermission(supabase))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (campaign.status === "sent" || campaign.status === "sending") {
      return NextResponse.json({ error: "Campaign already sent — cannot edit" }, { status: 403 })
    }

    const body = await req.json()
    const update: Record<string, unknown> = {}
    Object.keys(body || {}).forEach((k) => { if (allowed.has(k)) update[k] = body[k] })
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from("campaigns").update(update).eq("id", params.id).select("*").single()
    if (error) return apiError(error, 400)
    return NextResponse.json(data)
  } catch (error) {
    log("patch campaign error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
