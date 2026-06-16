"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Banknote,
  DollarSign,
  Kanban,
  Layers,
  List,
  Plus,
  TrendingUp,
} from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import { Can } from "@/components/auth/Can"
import OffersKanbanView from "@/components/offers/offers-kanban-view"
import OffersListView from "@/components/offers/offers-list-view"
import OfferDetailDrawer from "@/components/offers/offer-detail-drawer"
import CreateOfferModal from "@/components/offers/CreateOfferModal"
import { OfferService } from "@/services/offer-service"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePermissions } from "@/hooks/use-permissions"
import type { OfferWithRelations } from "@/lib/supabase"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export default function OffersPage() {
  const { can, loading: permissionsLoading } = usePermissions()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<OfferWithRelations | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ["offers"],
    queryFn: () => OfferService.getOffers(),
    enabled: !permissionsLoading && can("offers.view"),
  })

  // Spread = (accepted_price ?? offer_price) − properties.buy_price. Only honest when
  // we actually know the buy price, so offers without buy_price are skipped.
  const spreadOf = (offer: OfferWithRelations) => {
    const buyPrice = offer.properties?.buy_price
    if (buyPrice == null) return null
    const sale = offer.accepted_price ?? offer.offer_price ?? 0
    return sale - buyPrice
  }

  const activeOffers = offers.filter((offer) => offer.status === "submitted" || offer.status === "countered")
  const activeCount = activeOffers.length
  const pipelineValue = activeOffers.reduce((sum, offer) => sum + (offer.offer_price || 0), 0)
  const projectedSpread = offers
    .filter((offer) => ["submitted", "countered", "accepted"].includes(offer.status || ""))
    .reduce((sum, offer) => sum + (spreadOf(offer) ?? 0), 0)
  const collected = offers
    .filter((offer) => offer.status === "closed")
    .reduce((sum, offer) => sum + (spreadOf(offer) ?? 0), 0)

  const handleOfferClick = (offer: OfferWithRelations) => {
    setSelectedOffer(offer)
    setShowDrawer(true)
  }

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="p-4 text-sm text-muted-foreground">Checking offer permissions...</div>
      </MainLayout>
    )
  }

  if (!can("offers.view")) {
    return (
      <MainLayout>
        <div className="space-y-2 p-4">
          <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
          <p className="text-sm text-muted-foreground">You do not have permission to view offers.</p>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track pipeline value and projected profit</p>
          </div>
          <Can permission="offers.manage">
            <Button variant="brand" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add offer
            </Button>
          </Can>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              <p className="text-xs">Active offers</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-foreground">{activeCount}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <p className="text-xs">Pipeline value</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-foreground">{currencyFormatter.format(pipelineValue)}</p>
          </div>
          <div className="rounded-md bg-emerald-500/10 p-4">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-xs">Projected spread</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-emerald-600 dark:text-emerald-400">{currencyFormatter.format(projectedSpread)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" />
              <p className="text-xs">Collected</p>
            </div>
            <p className="mt-1.5 text-[22px] font-medium text-emerald-600 dark:text-emerald-400">{currencyFormatter.format(collected)}</p>
          </div>
        </div>

        <Tabs defaultValue="board" className="w-full">
          <TabsList className="inline-flex h-auto gap-1 rounded-lg bg-muted p-1">
            <TabsTrigger
              value="board"
              className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Kanban className="mr-2 h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <List className="mr-2 h-4 w-4" />
              List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            <OffersKanbanView
              offers={offers}
              isLoading={isLoading}
              onRefetch={refetch}
              onOfferClick={handleOfferClick}
              canManage={can("offers.manage")}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <OffersListView offers={offers} isLoading={isLoading} onOfferClick={handleOfferClick} />
          </TabsContent>
        </Tabs>

        <CreateOfferModal open={showCreate} onOpenChange={setShowCreate} onSuccess={refetch} />
        <OfferDetailDrawer
          open={showDrawer}
          onOpenChange={setShowDrawer}
          offer={selectedOffer}
          onSuccess={refetch}
          canManage={can("offers.manage")}
        />
      </div>
    </MainLayout>
  )
}
