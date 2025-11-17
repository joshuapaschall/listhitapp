"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import AddBuyerModal from "@/components/buyers/add-buyer-modal"
import ScheduleShowingModal from "@/components/showings/schedule-showing-modal"
import CreateOfferModal from "@/components/offers/CreateOfferModal"
import { UserPlus, Home, Calendar, FileText } from "lucide-react"

export default function QuickActionButtons() {
  const [showAddBuyer, setShowAddBuyer] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showCreateOffer, setShowCreateOffer] = useState(false)

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={() => setShowAddBuyer(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Buyer
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href="/properties/add">
            <Home className="mr-2 h-4 w-4" /> Add Property
          </Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowSchedule(true)}>
          <Calendar className="mr-2 h-4 w-4" /> Schedule Showing
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowCreateOffer(true)}>
          <FileText className="mr-2 h-4 w-4" /> Create Offer
        </Button>
      </div>
      <AddBuyerModal open={showAddBuyer} onOpenChange={setShowAddBuyer} />
      <ScheduleShowingModal open={showSchedule} onOpenChange={setShowSchedule} />
      <CreateOfferModal open={showCreateOffer} onOpenChange={setShowCreateOffer} />
    </>
  )
}
