import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { assertServer } from "@/utils/assert-server"
import { getEmailCampaignCostMetrics } from "@/services/email-metrics-service"

assertServer()

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const campaignId = (params.id ?? "").trim().replace(/^<+/, "").replace(/>+$/, "")
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization context required" }, { status: 400 })

  const { data: campaign } = await supabase.from("campaigns").select("id,org_id,channel").eq("id", campaignId).eq("org_id", orgId).maybeSingle()
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  const recipientsBaseSelect = "id,buyer_id,status,sent_at,delivered_at,opened_at,clicked_at,replied_at,bounced_at,complained_at,unsubscribed_at,error,actual_cost_usd,actual_segments,recipient_carrier"
  const recipientsBuyerSelect = "buyer:buyers(id,email,phone,fname,lname,full_name,company)"
  const recipientsLegacyBuyerSelect = "buyer:buyers(id,email_address,phone_number,first_name,last_name,full_name,company)"
  const recipientsRes = await supabase.from("campaign_recipients").select(`${recipientsBaseSelect},${recipientsBuyerSelect}`).eq("campaign_id", campaignId).order("id", { ascending: true })
  const recipientsFinal = recipientsRes.error ? await supabase.from("campaign_recipients").select(`${recipientsBaseSelect},${recipientsLegacyBuyerSelect}`).eq("campaign_id", campaignId).order("id", { ascending: true }) : recipientsRes

  const recipients = (recipientsFinal.error ? [] : recipientsFinal.data || []).map((row: any) => ({ ...row, email: row?.buyer?.email ?? row?.buyer?.email_address ?? null }))

  if (campaign.channel === "sms") {
    const [sumRes, linksRes, timelineRes] = await Promise.all([
      supabase.rpc("campaign_sms_summary", { p_campaign_id: campaignId }),
      supabase.rpc("campaign_sms_top_links", { p_campaign_id: campaignId }),
      supabase.rpc("campaign_sms_timeline", { p_campaign_id: campaignId }),
    ])
    ;[sumRes, linksRes, timelineRes].forEach((r: any, i) => r.error && console.error("Analytics RPC failed", { rpc: i, error: r.error }))
    const summary = (sumRes.data || [])[0] || { total: 0, sent: 0, delivered: 0, clicked: 0, replied: 0, failed: 0, undelivered: 0, opted_out: 0, total_cost_usd: 0, total_segments: 0, avg_segments: 0 }
    const sent = Number(summary.sent) || 0
    const delivered = Number(summary.delivered) || 0
    const denom = delivered || sent || 0
    const rates = {
      deliveryRate: sent ? (delivered / sent) * 100 : 0,
      clickRate: denom ? ((Number(summary.clicked) || 0) / denom) * 100 : 0,
      replyRate: denom ? ((Number(summary.replied) || 0) / denom) * 100 : 0,
      failureRate: sent ? ((Number(summary.failed) || 0) / sent) * 100 : 0,
      optOutRate: denom ? ((Number(summary.opted_out) || 0) / denom) * 100 : 0,
      costPerMessage: sent ? (Number(summary.total_cost_usd) || 0) / sent : 0,
    }
    return NextResponse.json({ channel: "sms", summary, rates, timeline: (timelineRes.data || []).map((r: any) => ({ bucket: r.bucket, delivered: Number(r.delivered) || 0, clicked: Number(r.clicked) || 0, replied: Number(r.replied) || 0 })), topLinks: (linksRes.data || []).map((r: any) => ({ url: r.target_url, totalClicks: Number(r.total_clicks) || 0, uniqueClickers: Number(r.unique_clickers) || 0 })), recipients })
  }

  const [summaryRes, recipientSummaryRes, linksRes, timelineRes, recentRes, bounceBreakdownRes, costMetrics] = await Promise.all([
    supabase.rpc("campaign_event_summary", { p_campaign_id: campaignId }),
    supabase.rpc("campaign_recipient_summary", { p_campaign_id: campaignId }),
    supabase.rpc("campaign_top_links", { p_campaign_id: campaignId }),
    supabase.rpc("campaign_event_timeline", { p_campaign_id: campaignId }),
    supabase.rpc("campaign_recent_events", { p_campaign_id: campaignId }),
    supabase.from("email_events").select("payload").eq("campaign_id", campaignId).eq("event_type", "bounce"),
    getEmailCampaignCostMetrics(campaign.org_id, campaignId),
  ])
  const summary = {
    ...buildSummary(summaryRes.data || [], (recipientSummaryRes.data || [])[0] || {}, buildBounceBreakdown(bounceBreakdownRes.data || [])),
    totalCostUsd: costMetrics.totalCostUsd,
  }
  return NextResponse.json({ channel: "email", summary, rates: buildRates(summary), timeline: (timelineRes.data || []).map((row: any) => ({ bucket: row.bucket, opens: Number(row.opens) || 0, clicks: Number(row.clicks) || 0 })), topLinks: (linksRes.data || []).map((row: any) => ({ url: row.url, totalClicks: Number(row.total_clicks) || 0, uniqueClickers: Number(row.unique_clickers) || 0 })), recentEvents: (recentRes.data || []).map((row: any) => ({ eventTime: row.event_time, type: row.type, recipientId: row.recipient_id, buyerId: row.buyer_id, payload: row.payload || {} })), recipients })
}

type CampaignSummary = { recipients: number; sent: number; delivered: number; uniqueOpens: number; totalOpens: number; uniqueClicks: number; totalClicks: number; bounces: number; complaints: number; unsubscribes: number; errors: number; permanentBounces: number; transientBounces: number; totalCostUsd?: number }
type BounceBreakdown = { permanent: number; transient: number; other: number }
function buildBounceBreakdown(rows: any[]): BounceBreakdown { return rows.reduce((acc: BounceBreakdown, row: any) => { const type = (((row?.payload || {})?.bounce || {}).bounceType || "").toString().toLowerCase(); if (type.includes("permanent")) acc.permanent += 1; else if (type.includes("transient") || type.includes("temporary")) acc.transient += 1; else if (type) acc.other += 1; return acc }, { permanent: 0, transient: 0, other: 0 }) }
function buildSummary(rows: any[], recipientSummary: any, bounceBreakdown: BounceBreakdown): CampaignSummary { const totals: Record<string, { total: number; unique: number }> = {}; rows.forEach((r) => { const key = (r.event_type || "").toLowerCase(); totals[key] = { total: Number(r.total) || 0, unique: Number(r.unique_recipients) || 0 } }); return { recipients: Number(recipientSummary?.total ?? 0), sent: Number(recipientSummary?.sent ?? totals["send"]?.total ?? totals["sent"]?.total ?? 0), delivered: Number(recipientSummary?.delivered ?? totals["delivery"]?.total ?? 0), uniqueOpens: Number(totals["open"]?.unique || 0), totalOpens: Number(totals["open"]?.total || 0), uniqueClicks: Number(totals["click"]?.unique || 0), totalClicks: Number(totals["click"]?.total || 0), bounces: Number(recipientSummary?.bounced ?? totals["bounce"]?.total ?? 0), complaints: Number(recipientSummary?.complained ?? totals["complaint"]?.total ?? 0), unsubscribes: Number(recipientSummary?.unsubscribed ?? totals["unsubscribe"]?.total ?? 0), errors: Number(recipientSummary?.errors ?? 0), permanentBounces: bounceBreakdown.permanent, transientBounces: bounceBreakdown.transient } }
function buildRates(summary: CampaignSummary) { const d = summary.delivered || summary.sent || 0; return { deliveryRate: summary.sent ? (summary.delivered / summary.sent) * 100 : 0, openRate: d ? (summary.uniqueOpens / d) * 100 : 0, ctr: d ? (summary.uniqueClicks / d) * 100 : 0, clickToOpen: summary.uniqueOpens ? (summary.uniqueClicks / summary.uniqueOpens) * 100 : 0, bounceRate: d ? (summary.bounces / d) * 100 : 0, unsubRate: d ? (summary.unsubscribes / d) * 100 : 0, complaintRate: d ? (summary.complaints / d) * 100 : 0 } }
