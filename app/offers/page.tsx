"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import MainLayout from "@/components/layout/main-layout"
import CreateOfferModal from "@/components/offers/CreateOfferModal"
import OfferDetail from "@/components/offers/OfferDetail"
import BuyerSelector from "@/components/buyers/buyer-selector"
import PropertySelector from "@/components/buyers/property-selector"
import { OfferService } from "@/services/offer-service"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { Buyer, Property, Offer } from "@/lib/supabase"
import { MoreVertical } from "lucide-react"

const STATUSES = [
  "all",
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
  "countered",
  "closed",
]
const ITEMS_PER_PAGE = 10

export default function OffersPage() {
  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [status, setStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const { data: offers = [], isLoading, refetch } = useQuery({
    queryKey: ["offers", buyer?.id, property?.id, status],
    queryFn: () =>
      OfferService.getOffers({
        buyerId: buyer?.id,
        propertyId: property?.id,
        status: status === "all" ? undefined : status,
      }),
  })

  const pageCount = Math.ceil(offers.length / ITEMS_PER_PAGE) || 1
  const paged = offers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

  const displayName = (b: any) =>
    b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || "Unnamed"

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <h1 className="text-2xl font-bold">Offers</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreate(true)}>Add Offer</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Buyer</label>
            <BuyerSelector
              value={buyer}
              onChange={(v) => {
                setCurrentPage(1)
                setBuyer(v)
              }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Property</label>
            <PropertySelector
              value={property}
              onChange={(v) => {
                setCurrentPage(1)
                setProperty(v)
              }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <Select
              value={status}
              onValueChange={(v) => {
                setCurrentPage(1)
                setStatus(v)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s === "all" ? "All" : s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Offer Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>Loading...</TableCell>
                </TableRow>
              )}
              {!isLoading && paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No offers found.</TableCell>
                </TableRow>
              )}
              {paged.map((offer: any) => (
                <TableRow key={offer.id}>
                  <TableCell className="whitespace-nowrap font-mono text-sm">
                    {formatDate(offer.created_at)}
                  </TableCell>
                  <TableCell>
                    {offer.buyers ? displayName(offer.buyers) : "-"}
                  </TableCell>
                  <TableCell>
                    {offer.properties ? offer.properties.address : "-"}
                  </TableCell>
                  <TableCell>
                    {offer.offer_price ? `$${offer.offer_price}` : "-"}
                  </TableCell>
                  <TableCell>{offer.status}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <span className="sr-only">Actions</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedOffer(offer)
                            setShowDetail(true)
                          }}
                        >
                          View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {pageCount > 1 && (
          <Pagination className="mt-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(Math.max(1, currentPage - 1))
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: pageCount }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={currentPage === i + 1}
                    onClick={(e) => {
                      e.preventDefault()
                      setCurrentPage(i + 1)
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(Math.min(pageCount, currentPage + 1))
                  }}
                  className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
        <CreateOfferModal open={showCreate} onOpenChange={setShowCreate} onSuccess={refetch} />
        <OfferDetail
          open={showDetail}
          onOpenChange={setShowDetail}
          offer={selectedOffer}
          onSuccess={refetch}
        />
      </div>
    </MainLayout>
  )
}

