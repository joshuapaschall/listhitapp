import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { assertServer } from "@/utils/assert-server"

assertServer()

type WindowParam = "24h" | "7d" | "30d"

const WINDOW_MAP: Record<WindowParam, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const windowParam = (url.searchParams.get("window") || "7d") as WindowParam

  if (!WINDOW_MAP[windowParam]) {
    return NextResponse.json({ error: "Invalid window" }, { status: 400 })
  }

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

  const { data, error } = await supabaseAdmin.rpc("deliverability_report", {
    p_user_id: user.id,
    p_window: WINDOW_MAP[windowParam],
  })

  if (error) {
    console.error("Deliverability report failed", error)
    return NextResponse.json({ error: "Failed to load deliverability" }, { status: 500 })
  }

  const report = (data || {}) as {
    kpis?: Record<string, number | string>
    recipients?: any[]
    top_links?: any[]
    link_clickers?: any[]
  }

  const sent = Number(report.kpis?.sent || 0)
  const delivered = Number(report.kpis?.delivered || 0)
  const opens = Number(report.kpis?.opens || 0)
  const clicks = Number(report.kpis?.clicks || 0)
  const bounces = Number(report.kpis?.bounces || 0)
  const complaints = Number(report.kpis?.complaints || 0)
  const unsubscribes = Number(report.kpis?.unsubscribes || 0)
  const errorsCount = Number(report.kpis?.errors || 0)

  const deliveryRate = sent ? (delivered / sent) * 100 : 0
  const openRate = delivered ? (opens / delivered) * 100 : sent ? (opens / sent) * 100 : 0
  const ctr = delivered ? (clicks / delivered) * 100 : sent ? (clicks / sent) * 100 : 0
  const bounceRate = sent ? (bounces / sent) * 100 : 0
  const complaintRate = sent ? (complaints / sent) * 100 : 0
  const unsubRate = sent ? (unsubscribes / sent) * 100 : 0

  return NextResponse.json({
    window: windowParam,
    kpis: {
      sent,
      delivered,
      opens,
      clicks,
      bounces,
      complaints,
      unsubscribes,
      errors: errorsCount,
    },
    rates: {
      deliveryRate,
      openRate,
      ctr,
      bounceRate,
      complaintRate,
      unsubRate,
    },
    recipients: report.recipients || [],
    topLinks: (report.top_links || []).map((row) => ({
      url: row.url,
      totalClicks: Number(row.total_clicks || row.totalClicks || 0),
      uniqueClickers: Number(row.unique_clickers || row.uniqueClickers || 0),
    })),
    linkClickers: report.link_clickers || [],
  })
}
