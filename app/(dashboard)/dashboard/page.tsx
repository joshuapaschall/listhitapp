"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import MainLayout from "@/components/layout/main-layout"
import DashboardHeader from "@/components/dashboard/DashboardHeader"
import QuickActionButtons from "@/components/dashboard/QuickActionButtons"
import KPISection from "@/components/dashboard/KPISection"
import ChartsSection from "@/components/dashboard/ChartsSection"
import RecentActivity from "@/components/dashboard/RecentActivity"
import {
  Gauge,
  Mail,
  MessageCircle,
  Phone,
  LineChart,
  Home as HomeIcon,
  Calendar,
  Handshake,
  PiggyBank,
} from "lucide-react"
import {
  fetchKpis,
  fetchTextTrends,
  fetchCallTrends,
  fetchEmailTrends,
  fetchOfferTrends,
  fetchShowingTrends,
  fetchUnsubscribeTrends,
  fetchRecentActivity,
  type TimeRange,
} from "@/services/dashboard-service"
import { useQuery } from "@tanstack/react-query"
import BuyersAddedCard from "@/components/dashboard/kpi-cards/BuyersAddedCard"
import PropertiesAddedCard from "@/components/dashboard/kpi-cards/PropertiesAddedCard"
import ActivePropertiesCard from "@/components/dashboard/kpi-cards/ActivePropertiesCard"
import UnderContractCard from "@/components/dashboard/kpi-cards/UnderContractCard"
import SoldPropertiesCard from "@/components/dashboard/kpi-cards/SoldPropertiesCard"
import TotalPropertiesCard from "@/components/dashboard/kpi-cards/TotalPropertiesCard"
import TextsSentCard from "@/components/dashboard/kpi-cards/TextsSentCard"
import TextsReceivedCard from "@/components/dashboard/kpi-cards/TextsReceivedCard"
import CallsMadeCard from "@/components/dashboard/kpi-cards/CallsMadeCard"
import CallsReceivedCard from "@/components/dashboard/kpi-cards/CallsReceivedCard"
import EmailsSentCard from "@/components/dashboard/kpi-cards/EmailsSentCard"
import EmailsReceivedCard from "@/components/dashboard/kpi-cards/EmailsReceivedCard"
import CampaignsRunningCard from "@/components/dashboard/kpi-cards/CampaignsRunningCard"
import TotalContactsCard from "@/components/dashboard/kpi-cards/TotalContactsCard"
import OffersCreatedCard from "@/components/dashboard/kpi-cards/OffersCreatedCard"
import OffersAcceptedCard from "@/components/dashboard/kpi-cards/OffersAcceptedCard"
import OffersDeclinedCard from "@/components/dashboard/kpi-cards/OffersDeclinedCard"
import OffersCounteredCard from "@/components/dashboard/kpi-cards/OffersCounteredCard"
import ShowingsScheduledCard from "@/components/dashboard/kpi-cards/ShowingsScheduledCard"
import OffersReceivedCard from "@/components/dashboard/kpi-cards/OffersReceivedCard"
import ShowingsRescheduledCard from "@/components/dashboard/kpi-cards/ShowingsRescheduledCard"
import ShowingsCancelledCard from "@/components/dashboard/kpi-cards/ShowingsCancelledCard"
import ShowingsCompletedCard from "@/components/dashboard/kpi-cards/ShowingsCompletedCard"
import GrossProfitCard from "@/components/dashboard/kpi-cards/GrossProfitCard"
import CloseRateCard from "@/components/dashboard/kpi-cards/CloseRateCard"
import NetProfitCard from "@/components/dashboard/kpi-cards/NetProfitCard"
import AvgAssignmentFeeCard from "@/components/dashboard/kpi-cards/AvgAssignmentFeeCard"
import CampaignRoiCard from "@/components/dashboard/kpi-cards/CampaignRoiCard"
import BounceRateCard from "@/components/dashboard/kpi-cards/BounceRateCard"
import UnsubscribeRateCard from "@/components/dashboard/kpi-cards/UnsubscribeRateCard"
import SpamComplaintRateCard from "@/components/dashboard/kpi-cards/SpamComplaintRateCard"
import OpenRateCard from "@/components/dashboard/kpi-cards/OpenRateCard"
import ClickRateCard from "@/components/dashboard/kpi-cards/ClickRateCard"

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const { data: kpis = null } = useQuery({
    queryKey: ["dashboard-kpis", range],
    queryFn: () => fetchKpis(range),
  })

  const { data: textTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["text-trends", range],
    queryFn: () => fetchTextTrends(range),
  })

  const { data: callTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["call-trends", range],
    queryFn: () => fetchCallTrends(range),
  })

  const { data: emailTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["email-trends", range],
    queryFn: () => fetchEmailTrends(range),
  })

  const { data: offerTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["offer-trends", range],
    queryFn: () => fetchOfferTrends(range),
  })

  const { data: showingTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["showing-trends", range],
    queryFn: () => fetchShowingTrends(range),
  })

  const { data: unsubscribeTrends = { data: [], delta: 0 } } = useQuery({
    queryKey: ["unsubscribe-trends", range],
    queryFn: () => fetchUnsubscribeTrends(range),
  })

  const { data: activity = [] } = useQuery({
    queryKey: ["recent-activity", range],
    queryFn: () => fetchRecentActivity(range),
  })

  return (
    <MainLayout>
      <div className="p-4 space-y-6">
        <DashboardHeader range={range} onRangeChange={handleRangeChange} />
        <QuickActionButtons />
        {kpis && (
          <div className="space-y-4">
            <KPISection title="High Level Metrics" icon={Gauge} shade="odd">
              <TotalContactsCard value={kpis.totalContacts} />
              <BuyersAddedCard value={kpis.buyersAdded} />
              <PropertiesAddedCard value={kpis.propertiesAdded} />
              <ShowingsScheduledCard value={kpis.showingsScheduled} />
              <OffersReceivedCard value={kpis.offersCreated} />
            </KPISection>
            <KPISection title="Email Metrics" icon={Mail} shade="even">
              <EmailsSentCard value={kpis.emailsSent} />
              <EmailsReceivedCard value={kpis.emailsReceived} />
              <OpenRateCard value={kpis.openRate} />
              <ClickRateCard value={kpis.clickRate} />
              <BounceRateCard value={kpis.bounceRate} />
              <UnsubscribeRateCard value={kpis.unsubscribeRate} />
              <SpamComplaintRateCard value={0} />
            </KPISection>
            <KPISection title="SMS Metrics" icon={MessageCircle} shade="odd">
              <TextsSentCard value={kpis.textsSent} />
              <TextsReceivedCard value={kpis.textsReceived} />
              <ClickRateCard value={kpis.clickRate} />
              <UnsubscribeRateCard value={kpis.unsubscribeRate} />
            </KPISection>
            <KPISection title="Call Metrics" icon={Phone} shade="even">
              <CallsMadeCard value={kpis.callsMade} />
              <CallsReceivedCard value={kpis.callsReceived} />
            </KPISection>
            <KPISection title="Campaign Metrics" icon={LineChart} shade="odd">
              <CampaignsRunningCard value={kpis.campaignsRunning} />
            </KPISection>
            <KPISection title="Property Metrics" icon={HomeIcon} shade="even">
              <TotalPropertiesCard value={kpis.totalProperties} />
              <ActivePropertiesCard value={kpis.activeProperties} />
              <UnderContractCard value={kpis.underContract} />
              <SoldPropertiesCard value={kpis.soldProperties} />
              <PropertiesAddedCard value={kpis.propertiesAdded} />
            </KPISection>
            <KPISection title="Showing Metrics" icon={Calendar} shade="odd">
              <ShowingsScheduledCard value={kpis.showingsScheduled} />
              <ShowingsRescheduledCard value={kpis.showingsRescheduled} />
              <ShowingsCancelledCard value={kpis.showingsCancelled} />
              <ShowingsCompletedCard value={kpis.showingsCompleted} />
            </KPISection>
            <KPISection title="Offer Metrics" icon={Handshake} shade="even">
              <OffersCreatedCard value={kpis.offersCreated} />
              <OffersAcceptedCard value={kpis.offersAccepted} />
              <OffersCounteredCard value={kpis.offersCountered} />
              <OffersDeclinedCard value={kpis.offersDeclined} />
            </KPISection>
            <KPISection title="Profit & Performance" icon={PiggyBank} shade="odd">
              <CloseRateCard value={kpis.closeRate} />
              <GrossProfitCard value={kpis.grossProfit} />
              <NetProfitCard value={kpis.netProfit} />
              <AvgAssignmentFeeCard value={kpis.avgAssignmentFee} />
              <CampaignRoiCard value={kpis.campaignRoi} />
            </KPISection>
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold mb-2">Performance Trends</h2>
          <ChartsSection
            textTrends={textTrends}
            callTrends={callTrends}
            emailTrends={emailTrends}
            offerTrends={offerTrends}
            showingTrends={showingTrends}
            unsubscribeTrends={unsubscribeTrends}
          />
        </div>
        <RecentActivity items={activity} />
      </div>
    </MainLayout>
  )
}
