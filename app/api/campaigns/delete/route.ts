import { NextRequest } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"

async function hasAnyCampaignSendPermission(supabase: any) {
  return (
    (await hasPermission(supabase, "campaigns.send_sms")) ||
    (await hasPermission(supabase, "campaigns.send_email"))
  )
}

export async function POST(request: NextRequest) {
  const { campaignId } = await request.json()

  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { user, orgId, supabase } = await requireOrgContext()

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!orgId) {
    return new Response(JSON.stringify({ error: "Organization context required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("org_id", orgId)
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

  if (!(await hasAnyCampaignSendPermission(supabase))) {
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
