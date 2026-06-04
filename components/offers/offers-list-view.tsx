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
              <TableHead>Buyer</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Offer price</TableHead>
              <TableHead>Spread</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8}>Loading...</TableCell>
              </TableRow>
            )}
            {!isLoading && pagedOffers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No offers found.</TableCell>
              </TableRow>
            )}
            {pagedOffers.map((offer) => {
              const buyerName = offer.buyers?.full_name || `${offer.buyers?.fname || ""} ${offer.buyers?.lname || ""}`.trim() || "Unnamed"
              const initials = `${offer.buyers?.fname?.[0] || ""}${offer.buyers?.lname?.[0] || ""}`.toUpperCase() || "?"
              const offerType = (offer.offer_type || "financing").toLowerCase()
              const status = offer.status || "submitted"
              const buyPrice = offer.properties?.buy_price
              const spread = buyPrice == null ? null : (offer.accepted_price ?? offer.offer_price ?? 0) - buyPrice
              const statusClass = status === "submitted"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : status === "countered"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : status === "accepted"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : status === "closed"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : status === "rejected"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-muted text-muted-foreground"

              return (
                <TableRow key={offer.id} className="cursor-pointer" onClick={() => onOfferClick(offer)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">{initials}</div>
                      <span className="truncate text-sm text-foreground">{buyerName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{offer.properties?.address || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{currencyFormatter.format(offer.offer_price || 0)}</TableCell>
                  <TableCell className="text-sm">
                    {spread == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={spread >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {spread >= 0 ? "+" : "−"}{currencyFormatter.format(Math.abs(spread))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">{offerType === "cash" ? "Cash" : "Financing"}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass}`}>{status}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {offer.created_at
                      ? new Date(offer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
