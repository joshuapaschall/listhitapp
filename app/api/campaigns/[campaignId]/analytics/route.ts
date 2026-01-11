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
  const recipientsQuery = supabaseAdmin
    .from("campaign_recipients")
    .select(
      "id,buyer_id,status,sent_at,delivered_at,opened_at,clicked_at,bounced_at,complained_at,unsubscribed_at,error,buyer:buyers(id,email,fname,lname,full_name,company)",
    )
    .eq("campaign_id", campaignId)
    .order("id", { ascending: true })
  const bounceBreakdownQuery = supabaseAdmin
    .from("email_events")
    .select("payload,buyer:buyers(id,email,fname,lname,full_name,company)")
    .eq("campaign_id", campaignId)
    .eq("event_type", "bounce")

  const [
    summaryRes,
    recipientSummaryRes,
    linksRes,
    timelineRes,
    recentRes,
    recipientsRes,
    bounceBreakdownRes,
  ] = await Promise.all([
    summaryQuery,
    recipientSummaryQuery,
    topLinksQuery,
    timelineQuery,
    recentQuery,
    recipientsQuery,
    bounceBreakdownQuery,
  ])

  const rpcErrors = [
    { name: "campaign_event_summary", error: summaryRes.error },
    { name: "campaign_recipient_summary", error: recipientSummaryRes.error },
    { name: "campaign_top_links", error: linksRes.error },
    { name: "campaign_event_timeline", error: timelineRes.error },
    { name: "campaign_recent_events", error: recentRes.error },
  ].filter((item) => item.error)

  if (rpcErrors.length > 0) {
    const first = rpcErrors[0]
    console.error("Analytics RPC failed", { rpc: first.name, error: first.error })
    return NextResponse.json({ error: `Analytics RPC failed: ${first.name}` }, { status: 500 })
  }

  if (recipientsRes.error || bounceBreakdownRes.error) {
    console.error("Analytics query failed", {
      recipients: recipientsRes.error,
      bounce: bounceBreakdownRes.error,
    })
    return NextResponse.json({ error: "Analytics query failed" }, { status: 500 })
  }

  const summaryRows = summaryRes.data || []
  const recipientSummary = (recipientSummaryRes.data || [])[0] || {}
  const bounceBreakdown = buildBounceBreakdown(bounceBreakdownRes.data || [])
  const summary = buildSummary(summaryRows, recipientSummary, bounceBreakdown)
  const rates = buildRates(summary)

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

  const recentEvents = (recentRes.data || []).map((row: any) => ({
    eventTime: row.event_time,
    type: row.type,
    recipientId: row.recipient_id,
    buyerId: row.buyer_id,
    payload: row.payload || {},
  }))

  const recipients = (recipientsRes.data || []).map((row: any) => ({
    id: row.id,
    buyer_id: row.buyer_id,
    email: row.buyer?.email ?? null,
    status: row.status,
    sent_at: row.sent_at,
    delivered_at: row.delivered_at,
    opened_at: row.opened_at,
    clicked_at: row.clicked_at,
    bounced_at: row.bounced_at,
    complained_at: row.complained_at,
    unsubscribed_at: row.unsubscribed_at,
    error: row.error,
    buyer: row.buyer ?? null,
  }))

  return NextResponse.json({
    summary,
    rates,
    timeline,
    topLinks,
    recentEvents,
    recipients,
  })
}

type CampaignSummary = {
  recipients: number
  sent: number
  delivered: number
  uniqueOpens: number
  totalOpens: number
  uniqueClicks: number
  totalClicks: number
  bounces: number
  complaints: number
  unsubscribes: number
  errors: number
  permanentBounces: number
  transientBounces: number
}

function buildSummary(rows: any[], recipientSummary: any, bounceBreakdown: BounceBreakdown): CampaignSummary {
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
  const unsubscribes = Number(
    recipientSummary?.unsubscribed ??
      totals["unsubscribe"]?.total ??
      totals["unsub"]?.total ??
      0,
  )
  const errors = Number(recipientSummary?.errors ?? 0)

  return {
    recipients: Number(recipientSummary?.total ?? 0),
    sent,
    delivered,
    uniqueOpens,
    totalOpens,
    uniqueClicks,
    totalClicks,
    bounces,
    complaints,
    unsubscribes,
    errors,
    permanentBounces: bounceBreakdown.permanent,
    transientBounces: bounceBreakdown.transient,
  }
}

type BounceBreakdown = {
  permanent: number
  transient: number
  other: number
}

function buildBounceBreakdown(rows: any[]): BounceBreakdown {
  return rows.reduce(
    (acc: BounceBreakdown, row: any) => {
      const payload = row?.payload || {}
      const bounce = payload?.bounce || payload?.Bounce || payload?.notification?.bounce || {}
      const typeRaw =
        bounce?.bounceType ||
        bounce?.BounceType ||
        bounce?.type ||
        bounce?.notificationType ||
        ""
      const type = (typeRaw || "").toString().toLowerCase()
      if (type.includes("permanent")) {
        acc.permanent += 1
      } else if (type.includes("transient") || type.includes("temporary")) {
        acc.transient += 1
      } else if (type) {
        acc.other += 1
      }
      return acc
    },
    { permanent: 0, transient: 0, other: 0 },
  )
}

type CampaignRates = {
  deliveryRate: number
  openRate: number
  ctr: number
  clickToOpen: number
  bounceRate: number
  unsubRate: number
  complaintRate: number
}

function buildRates(summary: CampaignSummary): CampaignRates {
  const rateDenominator = summary.delivered || summary.sent || 0
  const deliveryRate = summary.sent ? (summary.delivered / summary.sent) * 100 : 0
  const openRate = rateDenominator ? (summary.uniqueOpens / rateDenominator) * 100 : 0
  const ctr = rateDenominator ? (summary.uniqueClicks / rateDenominator) * 100 : 0
  const bounceRate = rateDenominator ? (summary.bounces / rateDenominator) * 100 : 0
  const unsubRate = rateDenominator ? (summary.unsubscribes / rateDenominator) * 100 : 0
  const complaintRate = rateDenominator ? (summary.complaints / rateDenominator) * 100 : 0
  const clickToOpen = summary.uniqueOpens
    ? (summary.uniqueClicks / summary.uniqueOpens) * 100
    : 0

  return {
    deliveryRate,
    openRate,
    ctr,
    clickToOpen,
    bounceRate,
    unsubRate,
    complaintRate,
  }
}
