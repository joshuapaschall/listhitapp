import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import {
  fetchCallTrends,
  fetchEmailTrends,
  fetchFunnel,
  fetchKpis,
  fetchLiveDeals,
  fetchNeedsYouToday,
  fetchOfferTrends,
  fetchProfitMetrics,
  fetchRecentActivity,
  fetchShowingTrends,
  fetchTextTrends,
  fetchUnsubscribeTrends,
  type TimeRange,
} from "@/services/dashboard-service"

export const dynamic = "force-dynamic"

const validRanges: TimeRange[] = ["today", "week", "month"]

function isTimeRange(value: string): value is TimeRange {
  return validRanges.includes(value as TimeRange)
}

export async function GET(request: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const rangeParam = request.nextUrl.searchParams.get("range") ?? "week"
    if (!isTimeRange(rangeParam)) {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 })
    }

    const [
      kpis,
      textTrends,
      callTrends,
      emailTrends,
      offerTrends,
      showingTrends,
      unsubscribeTrends,
      recentActivity,
      profit,
      liveDeals,
      needsYouToday,
      funnel,
    ] = await Promise.all([
      fetchKpis(rangeParam, orgId, supabase),
      fetchTextTrends(rangeParam, orgId, supabase),
      fetchCallTrends(rangeParam, orgId, supabase),
      fetchEmailTrends(rangeParam, orgId, supabase),
      fetchOfferTrends(rangeParam, orgId, supabase),
      fetchShowingTrends(rangeParam, orgId, supabase),
      fetchUnsubscribeTrends(rangeParam, orgId, supabase),
      fetchRecentActivity(rangeParam, orgId, supabase),
      fetchProfitMetrics(rangeParam, orgId, supabase),
      fetchLiveDeals(orgId, supabase),
      fetchNeedsYouToday(orgId, supabase),
      fetchFunnel(rangeParam, orgId, supabase),
    ])

    return NextResponse.json({
      kpis,
      textTrends,
      callTrends,
      emailTrends,
      offerTrends,
      showingTrends,
      unsubscribeTrends,
      recentActivity,
      profit,
      liveDeals,
      needsYouToday,
      funnel,
    })
  } catch (err) {
    return apiError(err, 500)
  }
}
