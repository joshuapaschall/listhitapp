import { NextRequest, NextResponse } from "next/server"
import { getCronRequestToken, isJwtLike } from "@/lib/cron-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { processEmailQueue } from "@/services/campaign-sender"
import { assertServer } from "@/utils/assert-server"

assertServer()

export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const cronSecret = process.env.CRON_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY env var is required" },
      { status: 500 },
    )
  }
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET env var is required" },
      { status: 500 },
    )
  }

  const requestToken = getCronRequestToken(request)
  if (!requestToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let userId: string | null = null
  let authSource: "cron_secret" | "service_role" | "user_jwt"
  if (requestToken === cronSecret) {
    authSource = "cron_secret"
  } else if (requestToken === serviceRoleKey) {
    authSource = "service_role"
  } else if (isJwtLike(requestToken)) {
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(requestToken)
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    userId = user.id
    authSource = "user_jwt"
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let campaignQuery = supabaseAdmin
    .from("campaigns")
    .select("id,status,user_id")
    .eq("id", params.id)
  if (authSource === "user_jwt" && userId) {
    campaignQuery = campaignQuery.eq("user_id", userId)
  }

  const { data: campaign, error: campaignError } = await campaignQuery.maybeSingle()
  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  if (campaign.status !== "paused_by_safety") {
    return NextResponse.json(
      { error: "Campaign is not paused for safety" },
      { status: 409 },
    )
  }

  const { count, error: queueError } = await supabaseAdmin
    .from("email_campaign_queue")
    .update(
      {
        status: "pending",
        scheduled_for: new Date().toISOString(),
        locked_at: null,
        lock_expires_at: null,
        locked_by: null,
      },
      { count: "exact" },
    )
    .eq("campaign_id", params.id)
    .eq("status", "paused")

  if (queueError) {
    return NextResponse.json(
      { error: "Failed to resume campaign queue" },
      { status: 500 },
    )
  }

  const { error: updateError } = await supabaseAdmin
    .from("campaigns")
    .update({ status: "processing" })
    .eq("id", params.id)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update campaign status" },
      { status: 500 },
    )
  }

  await processEmailQueue(3)

  return NextResponse.json({ ok: true, resumed: count || 0 })
}
