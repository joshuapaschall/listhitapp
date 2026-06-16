"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import MainLayout from "@/components/layout/main-layout"
import QuickActionButtons from "@/components/dashboard/QuickActionButtons"
import RecentActivity from "@/components/dashboard/RecentActivity"
import ToggleTimeRange from "@/components/dashboard/ToggleTimeRange"
import ActivityTrend from "@/components/dashboard/cockpit/ActivityTrend"
import AllMetricsDrawer from "@/components/dashboard/cockpit/AllMetricsDrawer"
import ChannelCard from "@/components/dashboard/cockpit/ChannelCard"
import DashboardFunnel from "@/components/dashboard/cockpit/DashboardFunnel"
import DashboardGreeting from "@/components/dashboard/cockpit/DashboardGreeting"
import KpiStat from "@/components/dashboard/cockpit/KpiStat"
import LiveDealsPanel from "@/components/dashboard/cockpit/LiveDealsPanel"
import NeedsYouToday from "@/components/dashboard/cockpit/NeedsYouToday"
import ProfitZone from "@/components/dashboard/cockpit/ProfitZone"
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react"
import type {
  CallTrend,
  DashboardKpis,
  DashboardProfit,
  DealFunnel,
  EmailTrend,
  LiveDeal,
  NeedsYouToday as NeedsYouTodayData,
  OfferTrend,
  RecentActivityItem,
  ShowingTrend,
  TextTrend,
  TimeRange,
  TrendWithDelta,
  UnsubscribeTrend,
} from "@/services/dashboard-service"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSession } from "@/hooks/use-session"

type DashboardPayload = {
  kpis: DashboardKpis
  profit: DashboardProfit
  liveDeals: LiveDeal[]
  needsYouToday: NeedsYouTodayData
  funnel: DealFunnel
  textTrends: TrendWithDelta<TextTrend>
  callTrends: TrendWithDelta<CallTrend>
  emailTrends: TrendWithDelta<EmailTrend>
  offerTrends: TrendWithDelta<OfferTrend>
  showingTrends: TrendWithDelta<ShowingTrend>
  unsubscribeTrends: TrendWithDelta<UnsubscribeTrend>
  recentActivity: RecentActivityItem[]
}

const EMPTY_KPIS: DashboardKpis = {
  buyersAdded: 0,
  buyersAddedDelta: 0,
  propertiesAdded: 0,
  activeProperties: 0,
  underContract: 0,
  soldProperties: 0,
  totalProperties: 0,
  hotBuyers: 0,
  followUpsDue: 0,
  totalContacts: 0,
  textsSent: 0,
  textsSentDelta: 0,
  textsReceived: 0,
  textsReceivedDelta: 0,
  callsMade: 0,
  callsMadeDelta: 0,
  callsReceived: 0,
  callsReceivedDelta: 0,
  voicemailsLeft: 0,
  emailsSent: 0,
  emailsSentDelta: 0,
  emailsOpened: 0,
  emailBounces: 0,
  openRate: 0,
  clickRate: 0,
  bounceRate: 0,
  smsUnsubscribes: 0,
  emailUnsubscribes: 0,
  unsubscribeRate: 0,
  unsubscribeRateDelta: 0,
  campaignsRunning: 0,
  campaignRoi: 0,
  offersCreated: 0,
  offersCreatedDelta: 0,
  offersAccepted: 0,
  offersAcceptedDelta: 0,
  offersDeclined: 0,
  offersCountered: 0,
  showingsScheduled: 0,
  showingsScheduledDelta: 0,
  showingsRescheduled: 0,
  showingsCancelled: 0,
  showingsCompleted: 0,
  grossProfit: 0,
  netProfit: 0,
  avgAssignmentFee: 0,
  closeRate: 0,
}

const EMPTY_PROFIT: DashboardProfit = {
  grossProfit: 0,
  closedCount: 0,
  avgAssignmentFee: 0,
  marketingSpend: 0,
  netProfit: 0,
  marketingRoi: null,
  hasData: false,
}

const EMPTY_NEEDS_YOU_TODAY: NeedsYouTodayData = {
  unreadReplies: 0,
  offersAwaiting: 0,
  showingsToday: 0,
  followUpsDue: 0,
}

const EMPTY_FUNNEL: DealFunnel = {
  buyers: 0,
  showings: 0,
  offers: 0,
  closed: 0,
}

async function fetchDashboard(range: TimeRange): Promise<DashboardPayload> {
  const response = await fetch(`/api/dashboard?range=${range}`)
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || "Failed to load dashboard")
  }

  return response.json()
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSession()
  const [range, setRange] = useState<TimeRange>(() => {
    const param = searchParams.get("range") as TimeRange | null
    if (param === "week" || param === "month" || param === "today") return param
    return "today"
  })

  const handleRangeChange = (r: TimeRange) => {
    setRange(r)
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", r)
    router.replace(`?${params.toString()}`)
  }

  const { data: dashboardData = null } = useQuery({
    queryKey: ["dashboard", range],
    queryFn: () => fetchDashboard(range),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const { data: onboarding } = useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding")
      if (!res.ok) throw new Error("Failed to load onboarding")
      return res.json() as Promise<{ doneCount: number; totalCount: number; completed: boolean }>
    },
    refetchOnWindowFocus: false,
  })

  const kpis = dashboardData?.kpis ?? EMPTY_KPIS
  const profit = dashboardData?.profit ?? EMPTY_PROFIT
  const liveDeals = dashboardData?.liveDeals ?? []
  const needsYouToday = dashboardData?.needsYouToday ?? EMPTY_NEEDS_YOU_TODAY
  const funnel = dashboardData?.funnel ?? EMPTY_FUNNEL
  const textTrends = dashboardData?.textTrends ?? { data: [], delta: 0 }
  const callTrends = dashboardData?.callTrends ?? { data: [], delta: 0 }
  const emailTrends = dashboardData?.emailTrends ?? { data: [], delta: 0 }
  const offerTrends = dashboardData?.offerTrends ?? { data: [], delta: 0 }
  const showingTrends = dashboardData?.showingTrends ?? { data: [], delta: 0 }
  const activity = dashboardData?.recentActivity ?? []
  const firstName = (
    user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split("@")[0]
    || ""
  ).split(" ")[0]
  const briefing = `${kpis.activeProperties} active properties · ${needsYouToday.offersAwaiting} offers awaiting your response · ${needsYouToday.showingsToday} showings today`

  return (
    <MainLayout>
      <div className="min-h-full bg-muted/40 p-4 sm:p-6 space-y-4">
        {onboarding && !onboarding.completed && (
          <Link
            href="/getting-started"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">Finish setting up your account</div>
              <p className="text-xs text-muted-foreground">
                {onboarding.doneCount} of {onboarding.totalCount} steps complete
              </p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-brand">
              Continue <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        )}
        <DashboardGreeting briefing={briefing} name={firstName}>
          <ToggleTimeRange value={range} onChange={handleRangeChange} />
        </DashboardGreeting>
        <QuickActionButtons />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiStat label="Active properties" value={kpis.activeProperties} sublabel="live inventory" />
          <KpiStat
            label="Buyers added"
            value={kpis.buyersAdded}
            delta={kpis.buyersAddedDelta}
            sublabel="this period"
          />
          <KpiStat
            label="Showings"
            value={kpis.showingsScheduled}
            delta={kpis.showingsScheduledDelta}
            spark={showingTrends.data.map((trend) => trend.scheduled ?? 0)}
          />
          <KpiStat
            label="Offers accepted"
            value={kpis.offersAccepted}
            delta={kpis.offersAcceptedDelta}
            spark={offerTrends.data.map((trend) => trend.accepted ?? 0)}
          />
          <KpiStat label="Close rate" value={`${Math.round(kpis.closeRate)}%`} sublabel="accepted / created" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <div className="lg:col-span-2">
            <DashboardFunnel data={funnel} />
          </div>
          <LiveDealsPanel deals={liveDeals} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <NeedsYouToday data={needsYouToday} />
          <ProfitZone data={profit} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ChannelCard
            title="Email"
            icon={Mail}
            href="/campaigns"
            rows={[
              { label: "Sent", value: kpis.emailsSent },
              { label: "Open rate", value: `${kpis.openRate}%` },
              { label: "Click rate", value: `${kpis.clickRate}%` },
            ]}
          />
          <ChannelCard
            title="SMS"
            icon={MessageCircle}
            href="/campaigns"
            rows={[
              { label: "Sent", value: kpis.textsSent },
              { label: "Replies", value: kpis.textsReceived },
              { label: "Opt-outs", value: kpis.smsUnsubscribes },
            ]}
          />
          <ChannelCard
            title="Calls"
            icon={Phone}
            href="/calls"
            rows={[
              { label: "Made", value: kpis.callsMade },
              { label: "Received", value: kpis.callsReceived },
              { label: "Voicemails", value: kpis.voicemailsLeft },
            ]}
          />
        </div>
        <ActivityTrend textTrends={textTrends} callTrends={callTrends} emailTrends={emailTrends} />
        <RecentActivity items={activity} />
        {dashboardData?.kpis ? <AllMetricsDrawer kpis={kpis} /> : null}
      </div>
    </MainLayout>
  )
}
