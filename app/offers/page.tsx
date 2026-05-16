"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2,
  DollarSign,
  Kanban,
  List,
  Plus,
  TrendingUp,
  XCircle,
} from "lucide-react"
import MainLayout from "@/components/layout/main-layout"
import OffersKanbanView from "@/components/offers/offers-kanban-view"
import OffersListView from "@/components/offers/offers-list-view"
import OfferDetailDrawer from "@/components/offers/offer-detail-drawer"
import CreateOfferModal from "@/components/offers/CreateOfferModal"
import { OfferService } from "@/services/offer-service"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { OfferWithRelations } from "@/lib/supabase"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export default function OffersPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<OfferWithRelations | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ["offers"],
    queryFn: () => OfferService.getOffers(),
  })

  const pipelineValue = offers
    .filter((offer) => offer.status === "submitted" || offer.status === "countered")
    .reduce((sum, offer) => sum + (offer.offer_price || 0), 0)
  const totalOffers = offers.length
  const accepted = offers.filter((offer) => offer.status === "accepted" || offer.status === "closed").length
  const rejected = offers.filter((offer) => offer.status === "rejected").length

  const handleOfferClick = (offer: OfferWithRelations) => {
    setSelectedOffer(offer)
    setShowDrawer(true)
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track offer pipeline and buyer activity</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Offer
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Pipeline Value</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{currencyFormatter.format(pipelineValue)}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Total Offers</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalOffers}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Accepted</p>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{accepted}</p>
          </Card>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Rejected</p>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{rejected}</p>
          </Card>
        </div>

        <Tabs defaultValue="board" className="w-full">
          <TabsList>
            <TabsTrigger value="board">
              <Kanban className="mr-2 h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="list">
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
        />
      </div>
    </MainLayout>
  )
}
