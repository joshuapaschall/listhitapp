"use client"

import { useEffect, useMemo, useState } from "react"
import { MoreVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OfferWithRelations } from "@/lib/supabase"

interface OffersListViewProps {
  offers: OfferWithRelations[]
  isLoading: boolean
  onOfferClick: (offer: OfferWithRelations) => void
}

const ITEMS_PER_PAGE = 10
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export default function OffersListView({ offers, isLoading, onOfferClick }: OffersListViewProps) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [offers])

  const pageCount = Math.ceil(offers.length / ITEMS_PER_PAGE) || 1
  const pagedOffers = useMemo(() => offers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [currentPage, offers])

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Offer Price</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && pagedOffers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>No offers found.</TableCell>
              </TableRow>
            )}
            {pagedOffers.map((offer) => {
              const buyerName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"
              const offerType = (offer.offer_type || "financing").toLowerCase()
              const status = offer.status || "submitted"
              const statusClass = status === "submitted"
                ? "bg-blue-500 hover:bg-blue-500/90"
                : status === "countered"
                  ? "bg-amber-500 hover:bg-amber-500/90"
                  : status === "accepted"
                    ? "bg-green-500 hover:bg-green-500/90"
                    : status === "closed"
                      ? "bg-purple-500 hover:bg-purple-500/90"
                      : status === "rejected"
                        ? "bg-red-500 hover:bg-red-500/90"
                        : "bg-gray-500 hover:bg-gray-500/90"

              return (
                <TableRow key={offer.id}>
                  <TableCell className="whitespace-nowrap text-sm">{offer.created_at ? new Date(offer.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{buyerName}</TableCell>
                  <TableCell>{offer.properties?.address || "—"}</TableCell>
                  <TableCell>{currencyFormatter.format(offer.offer_price || 0)}</TableCell>
                  <TableCell>
                    <Badge className={offerType === "cash" ? "bg-green-500 hover:bg-green-500/90" : "bg-blue-500 hover:bg-blue-500/90"}>{offerType === "cash" ? "Cash" : "Financing"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusClass}>{status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <span className="sr-only">Actions</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOfferClick(offer)}>View</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <Pagination>
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
    </div>
  )
}
