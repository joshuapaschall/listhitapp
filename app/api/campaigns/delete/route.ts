import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function POST(request: NextRequest) {
  const { campaignId } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignError) {
    console.error("Error fetching campaign for delete:", campaignError)
    return new Response(JSON.stringify({ error: campaignError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const ownerId = campaign.user_id ?? campaign.created_by
  if (!ownerId || ownerId !== user.id) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { error: queueError } = await supabase
    .from("email_campaign_queue")
    .delete()
    .eq("campaign_id", campaignId)
  if (queueError) {
    console.error("Error deleting campaign email queue rows:", queueError)
    return new Response(JSON.stringify({ error: queueError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { error: recipientError } = await supabase
    .from("campaign_recipients")
    .delete()
    .eq("campaign_id", campaignId)
  if (recipientError) {
    console.error("Error deleting campaign recipients:", recipientError)
    return new Response(JSON.stringify({ error: recipientError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { error: campaignDeleteError } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
  if (campaignDeleteError) {
    console.error("Error deleting campaign:", campaignDeleteError)
    return new Response(JSON.stringify({ error: campaignDeleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
