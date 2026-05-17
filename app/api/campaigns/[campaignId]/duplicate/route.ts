import { randomUUID } from "crypto"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createLogger } from "@/lib/logger"

const log = createLogger("api:campaigns:duplicate")

export async function POST(
  _req: Request,
  { params }: { params: { campaignId: string } },
) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: campaign, error: fetchError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", params.campaignId)
      .single()

    if (fetchError || !campaign || campaign.user_id !== user.id || campaign.deleted_at) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const duplicateCampaign = {
      id: randomUUID(),
      user_id: user.id,
      name: `${campaign.name} (copy)`,
      subject: campaign.subject,
      message: campaign.message,
      group_ids: campaign.group_ids,
      buyer_ids: campaign.buyer_ids,
      channel: campaign.channel,
      media_url: campaign.media_url,
      scheduled_at: null,
      send_to_all_numbers: campaign.send_to_all_numbers,
      run_from: campaign.run_from,
      run_until: campaign.run_until,
      weekday_only: campaign.weekday_only,
      timezone: campaign.timezone,
      status: "draft",
      created_at: new Date().toISOString(),
    }

    const { data: inserted, error: insertError } = await supabase
      .from("campaigns")
      .insert(duplicateCampaign)
      .select("*")
      .single()

    if (insertError) {
      log("failed to insert duplicate campaign", insertError)
      return NextResponse.json({ error: "Failed to duplicate campaign" }, { status: 500 })
    }

    return NextResponse.json(inserted, { status: 201 })
  } catch (error) {
    log("unexpected duplicate campaign error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
