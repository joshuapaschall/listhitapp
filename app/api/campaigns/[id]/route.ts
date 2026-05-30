import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:campaigns:patch")

const allowed = new Set([
  "name", "subject", "message", "group_ids", "buyer_ids", "scheduled_at", "timezone", "run_from", "run_until", "weekday_only", "media_url", "send_to_all_numbers", "from_name", "from_email", "preview_text", "status", "design_json", "mjml",
])

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id,status,user_id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    if (campaign.status === "sent" || campaign.status === "sending") {
      return NextResponse.json({ error: "Campaign already sent — cannot edit" }, { status: 403 })
    }

    const body = await req.json()
    const update: Record<string, unknown> = {}
    Object.keys(body || {}).forEach((k) => { if (allowed.has(k)) update[k] = body[k] })
    update.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from("campaigns").update(update).eq("id", params.id).select("*").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (error) {
    log("patch campaign error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
