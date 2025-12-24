import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { assertServer } from "@/utils/assert-server"

assertServer()

export async function GET(_req: NextRequest, { params }: { params: { campaignId: string } }) {
  const campaignId = params.campaignId
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { supabaseAdmin } = await import("@/lib/supabase")

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("id, user_id")
    .eq("id", campaignId)
    .maybeSingle()

  if (campaignErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  if (campaign.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const summaryQuery = supabaseAdmin.rpc("campaign_event_summary", { p_campaign_id: campaignId })
  const recipientSummaryQuery = supabaseAdmin.rpc("campaign_recipient_summary", { p_campaign_id: campaignId })
  const topLinksQuery = supabaseAdmin.rpc("campaign_top_links", { p_campaign_id: campaignId })
  const timelineQuery = supabaseAdmin.rpc("campaign_event_timeline", { p_campaign_id: campaignId })
  const recentQuery = supabaseAdmin.rpc("campaign_recent_events", { p_campaign_id: campaignId })

  const [summaryRes, recipientSummaryRes, linksRes, timelineRes, recentRes] = await Promise.all([
    summaryQuery,
    recipientSummaryQuery,
    topLinksQuery,
    timelineQuery,
    recentQuery,
  ])

  if (summaryRes.error || recipientSummaryRes.error || linksRes.error || timelineRes.error || recentRes.error) {
    console.error("Analytics query failed", {
      summary: summaryRes.error,
      recipients: recipientSummaryRes.error,
      links: linksRes.error,
      timeline: timelineRes.error,
      recent: recentRes.error,
    })
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }

  const summaryRows = summaryRes.data || []
  const recipientSummary = (recipientSummaryRes.data || [])[0] || {}
  const summary = buildSummary(summaryRows, recipientSummary)

  const topLinks = (linksRes.data || []).map((row: any) => ({
    url: row.url,
    totalClicks: Number(row.total_clicks) || 0,
    uniqueClickers: Number(row.unique_clickers) || 0,
  }))

  const timeline = (timelineRes.data || []).map((row: any) => ({
    bucket: row.bucket,
    opens: Number(row.opens) || 0,
    clicks: Number(row.clicks) || 0,
  }))

  const recentEvents = (recentRes.data || []).map((row: any) => {
    const type = (row.type || "").toLowerCase()
    const payload = row.payload || {}
    let url: string | null = null
    if (type === "click") {
      url = payload?.click?.link || payload?.link || null
    }
    const recipientEmail = payload?.mail?.destination?.[0] || payload?.destination?.[0] || null
    return {
      at: row.at,
      type,
      recipientEmail,
      url,
    }
  })

  return NextResponse.json({
    summary,
    topLinks,
    timeline,
    recentEvents,
  })
}

function buildSummary(rows: any[], recipientSummary: any) {
  const totals: Record<string, { total: number; unique: number }> = {}
  rows.forEach((r) => {
    const key = (r.event_type || "").toLowerCase()
    totals[key] = {
      total: Number(r.total) || 0,
      unique: Number(r.unique_recipients) || 0,
    }
  })

  const sent = Number(
    recipientSummary?.sent ??
      totals["send"]?.total ??
      totals["sent"]?.total ??
      0,
  )
  const delivered = Number(
    recipientSummary?.delivered ??
      totals["delivery"]?.total ??
      totals["delivered"]?.total ??
      0,
  )
  const totalOpens = Number(totals["open"]?.total || 0)
  const uniqueOpens = Number(totals["open"]?.unique || 0)
  const totalClicks = Number(totals["click"]?.total || 0)
  const uniqueClicks = Number(totals["click"]?.unique || 0)
  const bounces = Number(recipientSummary?.bounced ?? totals["bounce"]?.total ?? 0)
  const complaints = Number(recipientSummary?.complained ?? totals["complaint"]?.total ?? 0)
  const unsubs = Number(recipientSummary?.unsubscribed ?? totals["unsubscribe"]?.total ?? totals["unsub"]?.total ?? 0)
  const errors = Number(recipientSummary?.errors ?? 0)
  const baseRecipients = Number(
    recipientSummary?.sent ??
      recipientSummary?.total ??
      sent ??
      0,
  )

  const deliveryRate = baseRecipients ? (delivered / baseRecipients) * 100 : 0
  const openRate = baseRecipients ? (uniqueOpens / baseRecipients) * 100 : 0
  const ctr = baseRecipients ? (uniqueClicks / baseRecipients) * 100 : 0
  const bounceRate = baseRecipients ? (bounces / baseRecipients) * 100 : 0
  const unsubRate = baseRecipients ? (unsubs / baseRecipients) * 100 : 0
  const complaintRate = baseRecipients ? (complaints / baseRecipients) * 100 : 0
  const cto = uniqueOpens ? (uniqueClicks / uniqueOpens) * 100 : 0

  return {
    sent,
    delivered,
    uniqueOpens,
    totalOpens,
    uniqueClicks,
    totalClicks,
    bounces,
    complaints,
    unsubs,
    errors,
    rates: {
      deliveryRate,
      openRate,
      ctr,
      bounceRate,
      unsubRate,
      complaintRate,
      clickToOpen: cto,
    },
  }
}
